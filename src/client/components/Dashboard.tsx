import React, { useState, useMemo } from 'react';
import {
  Search,
  Clock,
  ArrowRight,
  BookOpen,
  BrainCircuit,
} from 'lucide-react';
import { type Guide, type UserProgressData, type UserSrsData, getGuideSections } from '../types.js';
import { MathText } from './MathText.js';

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

  const renderGuideCard = (guide: Guide) => {
    const status = getGuideStatus(guide);
    const sections = getGuideSections(guide);
    const totalSections = Math.max(1, sections.length);
    const completedCount = (progress.completed_sections[guide.id] || []).length;
    const progressPercent = Math.min(100, Math.round((completedCount / totalSections) * 100));
    const prereqsMet = arePrerequisitesMet(guide);

    return (
      <div
        key={guide.id}
        onClick={() => onSelectGuide(guide.id)}
        className="w-72 sm:w-80 flex-shrink-0 snap-start group bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
      >
        <div>
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
            <span>{!prereqsMet ? 'Prerequisites Pending' : 'Open Guide'}</span>
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
