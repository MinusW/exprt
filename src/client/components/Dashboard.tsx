import React, { useState, useMemo } from 'react';
import {
  Search,
  Clock,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  GitFork,
  X,
  ClipboardCheck,
} from 'lucide-react';
import { type Guide, type UserProgressData, type UserSrsData, getGuideSections } from '../types.js';
import { MathText } from './MathText.js';
import { KrokiBlockView } from './blocks/KrokiBlockView.js';
import { reduceTransitiveEdges } from '../utils/graph.js';

interface Props {
  guides: Guide[];
  progress: UserProgressData;
  srsData?: UserSrsData;
  onSelectGuide: (guideId: string) => void;
  onNavigateToSrs?: () => void;
  onToggleGuideComplete?: (guideId: string, sectionIds: string[], completed: boolean) => void;
  onResetGuideProgress?: (guideId: string) => void;
}

export const Dashboard: React.FC<Props> = ({
  guides,
  progress,
  srsData,
  onSelectGuide,
  onNavigateToSrs,
  onToggleGuideComplete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);

  const now = Date.now();
  const dueSrsCount = srsData?.items.filter((i) => i.due_date <= now).length || 0;

  const getGuideStatus = (guide: Guide): 'not-started' | 'in-progress' | 'completed' | 'needs-review' => {
    const completedSections = progress.completed_sections[guide.id] || [];
    const quizHistory = progress.quiz_history[guide.id] || {};
    const hasMissedQuiz = Object.values(quizHistory).some((q) => !q.is_correct);

    const sections = getGuideSections(guide);
    const totalSections = sections.length;

    if (totalSections > 0 && completedSections.length >= totalSections) {
      if (hasMissedQuiz) return 'needs-review';
      return 'completed';
    }

    if (completedSections.length > 0 || Object.keys(quizHistory).length > 0) {
      return 'in-progress';
    }

    return 'not-started';
  };

  const arePrerequisitesMet = (guide: Guide): boolean => {
    if (!guide.prerequisites || guide.prerequisites.length === 0) return true;
    return guide.prerequisites.every((prereqId) => {
      const prereqGuide = guides.find((g) => g.id === prereqId);
      if (!prereqGuide) return false;
      return getGuideStatus(prereqGuide) === 'completed';
    });
  };

  const filteredGuides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? guides.filter(
          (g) =>
            g.title.toLowerCase().includes(q) ||
            g.description.toLowerCase().includes(q) ||
            (g.category || '').toLowerCase().includes(q) ||
            (g.track || '').toLowerCase().includes(q) ||
            (g.folder || '').toLowerCase().includes(q) ||
            g.tags.some((t) => t.toLowerCase().includes(q))
        )
      : [...guides];

    return list.sort((a, b) => {
      const orderA = a.track_order ?? 999;
      const orderB = b.track_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
  }, [guides, searchQuery]);

  // Group filtered guides by category (one horizontal row per category)
  const groupedByCategory = useMemo(() => {
    const map: Record<string, Guide[]> = {};
    for (const g of filteredGuides) {
      const cat = g.category || g.folder || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    }
    return map;
  }, [filteredGuides]);

  const isMockTest = (guide: Guide): boolean =>
    guide.tags.some((t) => ['mock-exam', 'practice-test', 'exam'].includes(t.toLowerCase())) ||
    /(-mock-exam|-exam)$/i.test(guide.id);

  // Transitive-reduced course dependency graph (only computed when opened)
  const dependencyGraphSource = useMemo(() => {
    if (!showDependencyGraph || guides.length === 0) return '';
    const lines = ['graph LR'];
    lines.push('  classDef completed fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#065f46;');
    lines.push('  classDef inprogress fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e40af;');
    lines.push('  classDef review fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e;');
    lines.push('  classDef notstarted fill:#f1f5f9,stroke:#94a3b8,stroke-width:1.5px,color:#475569;');
    lines.push('  classDef mock_completed fill:#d1fae5,stroke:#059669,stroke-width:2px,stroke-dasharray:5 4,color:#065f46;');
    lines.push('  classDef mock_inprogress fill:#dbeafe,stroke:#2563eb,stroke-width:2px,stroke-dasharray:5 4,color:#1e40af;');
    lines.push('  classDef mock_review fill:#fef3c7,stroke:#d97706,stroke-width:2px,stroke-dasharray:5 4,color:#92400e;');
    lines.push('  classDef mock_notstarted fill:#fffbeb,stroke:#d97706,stroke-width:1.5px,stroke-dasharray:5 4,color:#92400e;');

    const rawEdges: Array<{ from: string; to: string }> = [];
    for (const g of guides) {
      const cleanId = g.id.replace(/-/g, '_');
      const safeTitle = g.title.replace(/["\(\)\[\]]/g, '');
      const status = getGuideStatus(g);
      const baseClass =
        status === 'completed'
          ? 'completed'
          : status === 'in-progress'
          ? 'inprogress'
          : status === 'needs-review'
          ? 'review'
          : 'notstarted';

      if (isMockTest(g)) {
        lines.push(`  ${cleanId}(["Test: ${safeTitle}"]):::mock_${baseClass}`);
      } else {
        lines.push(`  ${cleanId}["${safeTitle}"]:::${baseClass}`);
      }

      if (g.prerequisites && g.prerequisites.length > 0) {
        for (const prereqId of g.prerequisites) {
          rawEdges.push({ from: prereqId, to: g.id });
        }
      }
    }

    for (const { from, to } of reduceTransitiveEdges(rawEdges)) {
      lines.push(`  ${from.replace(/-/g, '_')} --> ${to.replace(/-/g, '_')}`);
    }

    return lines.join('\n');
  }, [showDependencyGraph, guides, progress]);

  const handleGraphNodeClick = (nodeId: string, label: string) => {
    const normalizedLabel = label.replace(/^Test:\s*/i, '').trim().toLowerCase();
    const match =
      guides.find((g) => g.id.replace(/-/g, '_') === nodeId) ||
      guides.find((g) => g.title.replace(/["\(\)\[\]]/g, '').trim().toLowerCase() === normalizedLabel);
    if (match) {
      onSelectGuide(match.id);
    }
  };

  const renderGuideCard = (guide: Guide) => {
    const status = getGuideStatus(guide);
    const sections = getGuideSections(guide);
    const totalSections = Math.max(1, sections.length);
    const completedCount = (progress.completed_sections[guide.id] || []).length;
    const progressPercent = Math.min(100, Math.round((completedCount / totalSections) * 100));
    const prereqsMet = arePrerequisitesMet(guide);
    const mockTest = isMockTest(guide);

    return (
      <div
        key={guide.id}
        onClick={() => onSelectGuide(guide.id)}
        className={`w-72 sm:w-80 flex-shrink-0 snap-start group bg-white border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
          mockTest
            ? 'border-amber-200 border-l-4 border-l-amber-400 hover:border-amber-400'
            : 'border-slate-200 hover:border-slate-400'
        }`}
      >
        <div>
          {mockTest && (
            <div className="flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">
              <ClipboardCheck className="w-3 h-3" />
              <span>Mock Test</span>
            </div>
          )}
          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-slate-700 transition leading-snug mb-1.5 line-clamp-2">
            {guide.title}
          </h3>
          <MathText
            text={guide.description}
            className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3"
          />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 mt-auto">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{guide.estimated_minutes} min</span>
            </span>

            <div className="flex items-center space-x-1.5">
              <span>
                {completedCount}/{totalSections}
              </span>
              {onToggleGuideComplete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const allIds = sections.map((s) => s.id);
                    const allDone = completedCount >= sections.length && sections.length > 0;
                    onToggleGuideComplete(guide.id, allIds, !allDone);
                  }}
                  className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-[10px] font-medium text-slate-600 transition"
                  title={
                    completedCount >= sections.length && sections.length > 0
                      ? 'Uncheck all sections'
                      : 'Mark all sections complete'
                  }
                >
                  {completedCount >= sections.length && sections.length > 0 ? 'Uncheck' : 'Check All'}
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                status === 'completed'
                  ? 'bg-emerald-500'
                  : status === 'needs-review'
                  ? 'bg-amber-500'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 group-hover:text-slate-900">
            <span>
              {!prereqsMet ? 'Prerequisites Pending' : mockTest ? 'Open Test' : 'Open Guide'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Minimal Search Bar (+ optional Daily Review shortcut when cards are due) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses and guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-500 focus:ring-2 focus:ring-slate-200 outline-none text-slate-800 shadow-2xs transition"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowDependencyGraph((v) => !v)}
          className={`inline-flex items-center justify-center space-x-2 px-4 py-2.5 border text-xs sm:text-sm font-semibold rounded-xl transition shadow-2xs whitespace-nowrap ${
            showDependencyGraph
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
          title="View course prerequisite diagram"
        >
          <GitFork className="w-4 h-4" />
          <span>Dependencies</span>
        </button>

        {dueSrsCount > 0 && onNavigateToSrs && (
          <button
            onClick={onNavigateToSrs}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs whitespace-nowrap"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>Daily Review ({dueSrsCount})</span>
          </button>
        )}
      </div>

      {/* Collapsible Course Dependency Diagram */}
      {showDependencyGraph && dependencyGraphSource && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center space-x-2">
              <GitFork className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-800">Course Dependencies</h3>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                (Click any node to open)
              </span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] flex-wrap gap-y-1">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-2.5 rounded-sm border border-slate-400 bg-slate-100 inline-block"></span>
                <span className="text-slate-600">Guide</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3.5 h-2.5 rounded-full border border-dashed border-amber-600 bg-amber-50 inline-block"></span>
                <span className="text-slate-600">Mock Test</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span className="text-slate-600">Completed</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                <span className="text-slate-600">In Progress</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span className="text-slate-600">Needs Review</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
                <span className="text-slate-600">Not Started</span>
              </span>
              <button
                type="button"
                onClick={() => setShowDependencyGraph(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                title="Close diagram"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <KrokiBlockView
            block={{
              id: 'curriculum-graph',
              block_type: 'kroki',
              diagram_type: 'mermaid',
              source: dependencyGraphSource,
              bookmarkable: false,
            }}
            onNodeClick={handleGraphNodeClick}
          />
        </div>
      )}

      {/* Category Rows (Horizontal Scroll per Category with Category Progress) */}
      {Object.keys(groupedByCategory).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-800 font-semibold text-sm">No courses match your search</h3>
          <p className="text-slate-500 text-xs mt-1">Try a different keyword or clear the search box.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByCategory).map(([categoryName, categoryGuides]) => {
            const completedGuides = categoryGuides.filter(
              (g) => getGuideStatus(g) === 'completed'
            ).length;

            let totalSectionsInCat = 0;
            let completedSectionsInCat = 0;
            for (const g of categoryGuides) {
              const secs = getGuideSections(g);
              totalSectionsInCat += secs.length;
              completedSectionsInCat += Math.min(
                secs.length,
                (progress.completed_sections[g.id] || []).length
              );
            }
            const catPercent =
              totalSectionsInCat > 0
                ? Math.round((completedSectionsInCat / totalSectionsInCat) * 100)
                : 0;

            return (
              <section key={categoryName} className="space-y-3">
                {/* Category Header + Progress */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {categoryName}
                    </h2>
                    <span className="text-xs font-medium text-slate-500">
                      ({categoryGuides.length} {categoryGuides.length === 1 ? 'course' : 'courses'})
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-medium text-slate-600">
                      {completedGuides}/{categoryGuides.length} done · {catPercent}%
                    </span>
                    <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          catPercent === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${catPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Single Horizontal Scrollable Line */}
                <div className="flex overflow-x-auto gap-4 pb-3 snap-x snap-mandatory">
                  {categoryGuides.map(renderGuideCard)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
