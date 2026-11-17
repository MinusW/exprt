import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Sparkles,
  RotateCcw,
  StickyNote,
  Link2,
  Check,
} from 'lucide-react';
import {
  type Guide,
  type GuideBlock,
  type QuizQuestionBlock,
  type FlashcardBlock,
  type UserProgressData,
  type BookmarkItem,
  type UserSrsData,
  getGuideSections,
} from '../types.js';
import { MarkdownBlockView } from './blocks/MarkdownBlockView.js';
import { CodeBlockView } from './blocks/CodeBlockView.js';
import { KrokiBlockView } from './blocks/KrokiBlockView.js';
import { MediaBlockView } from './blocks/MediaBlockView.js';
import { SandboxBlockView } from './blocks/SandboxBlockView.js';
import { SimulationBlockView } from './blocks/SimulationBlockView.js';
import { ReflectionRubricBlockView } from './blocks/ReflectionRubricBlockView.js';
import { FeynmanPromptBlockView } from './blocks/FeynmanPromptBlockView.js';
import { QuizBlockView } from './blocks/QuizBlockView.js';
import { FlashcardBlockView } from './blocks/FlashcardBlockView.js';
import { WeakSpotModal } from './WeakSpotModal.js';
import { SideNotesPanel } from './SideNotesPanel.js';

interface Props {
  guide: Guide;
  progress: UserProgressData;
  bookmarks: BookmarkItem[];
  srsData?: UserSrsData;
  onBack: () => void;
  onMarkPhaseComplete: (guideId: string, sectionId: string, forceState?: boolean) => void;
  onResetGuideProgress?: (guideId: string) => void;
  onSetAllSectionsComplete?: (guideId: string, sectionIds: string[], completed: boolean) => void;
  onResetQuizAnswer?: (guideId: string, questionId: string) => void;
  onRecordQuizAnswer: (
    guideId: string,
    questionId: string,
    selected: string | string[],
    isCorrect: boolean,
    block?: QuizQuestionBlock,
    guideTitle?: string
  ) => void;
  onSaveReflectionNote: (guideId: string, blockId: string, note: string) => void;
  onToggleBookmark: (item: Omit<BookmarkItem, 'bookmarked_at'>) => void;
  onRateFlashcard?: (
    guideId: string,
    guideTitle: string,
    flashcard: FlashcardBlock,
    rating: 1 | 2 | 3 | 4
  ) => void;
}

export type ReaderWidth = 'compact' | 'standard' | 'wide' | 'full';
export type FontSize = 'base' | 'lg' | 'xl';

export const GuideViewer: React.FC<Props> = ({
  guide,
  progress,
  bookmarks,
  srsData,
  onBack,
  onMarkPhaseComplete,
  onResetGuideProgress,
  onSetAllSectionsComplete,
  onResetQuizAnswer,
  onRecordQuizAnswer,
  onSaveReflectionNote,
  onToggleBookmark,
  onRateFlashcard,
}) => {
  // Dynamically obtain sections from guide (flexible structure)
  const sections = useMemo(() => getGuideSections(guide), [guide]);

  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [showSideNotes, setShowSideNotes] = useState<boolean>(() => {
    try {
      return localStorage.getItem('study_show_side_notes') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSideNotes = () => {
    setShowSideNotes((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('study_show_side_notes', String(next));
      } catch {}
      return next;
    });
  };

  // Reader sizing & appearance settings
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>(() => {
    try {
      return (localStorage.getItem('study_reader_width') as ReaderWidth) || 'standard';
    } catch {
      return 'standard';
    }
  });

  const [customWidthPx, setCustomWidthPx] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('study_reader_width_px');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) && parsed >= 480 ? parsed : null;
    } catch {
      return null;
    }
  });

  const [sideNotesWidthPx, setSideNotesWidthPx] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('study_side_notes_width_px');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) && parsed >= 260 ? parsed : 380;
    } catch {
      return 380;
    }
  });

  const [isDraggingResize, setIsDraggingResize] = useState<'container' | 'notes' | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    try {
      return (localStorage.getItem('study_font_size') as FontSize) || 'base';
    } catch {
      return 'base';
    }
  });

  const handleSetWidth = (w: ReaderWidth) => {
    setReaderWidth(w);
    setCustomWidthPx(null);
    try {
      localStorage.setItem('study_reader_width', w);
      localStorage.removeItem('study_reader_width_px');
    } catch {}
  };

  const handleUpdateSideNotesWidth = (w: number) => {
    const clamped = Math.max(260, Math.min(760, Math.round(w)));
    setSideNotesWidthPx(clamped);
    try {
      localStorage.setItem('study_side_notes_width_px', String(clamped));
    } catch {}
  };

  // Drag handler for outer guide container edges (left or right)
  const startContainerDrag = (side: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = containerRef.current?.getBoundingClientRect().width || 896;
    setIsDraggingResize('container');

    const onMove = (ev: PointerEvent) => {
      const delta = side === 'right' ? (ev.clientX - startX) * 2 : (startX - ev.clientX) * 2;
      const maxAllowed = Math.max(640, window.innerWidth - 32);
      const next = Math.max(540, Math.min(maxAllowed, Math.round(startWidth + delta)));
      setCustomWidthPx(next);
      try {
        localStorage.setItem('study_reader_width_px', String(next));
      } catch {}
    };

    const onUp = () => {
      setIsDraggingResize(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Drag handler for the vertical splitter between Guide Content and Side Notes
  const startNotesSplitterDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sideNotesWidthPx;
    setIsDraggingResize('notes');

    const onMove = (ev: PointerEvent) => {
      // Dragging left increases side notes width; dragging right decreases it
      const delta = startX - ev.clientX;
      handleUpdateSideNotesWidth(startWidth + delta);
    };

    const onUp = () => {
      setIsDraggingResize(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleSetFontSize = (size: FontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem('study_font_size', size);
    } catch {}
  };

  const widthClass = {
    compact: 'max-w-3xl',
    standard: 'max-w-4xl',
    wide: 'max-w-6xl',
    full: 'max-w-[96%]',
  }[readerWidth];

  const fontSizeClass = {
    base: 'text-base',
    lg: 'text-lg reader-font-lg',
    xl: 'text-xl reader-font-xl',
  }[fontSize];

  const activeSection =
    sections.find((s) => s.id === selectedSectionId) || sections[0];
  const completedSections = progress.completed_sections[guide.id] || [];
  const guideQuizHistory = progress.quiz_history[guide.id] || {};
  const guideNotes = progress.reflection_notes[guide.id] || {};

  // Check if block is bookmarked
  const isBlockBookmarked = (blockId: string) => {
    return bookmarks.some((b) => b.guide_id === guide.id && b.block_id === blockId);
  };

  // Collect all quiz questions across all sections
  const allQuizBlocks = useMemo(() => {
    const list: QuizQuestionBlock[] = [];
    for (const sec of sections) {
      for (const b of sec.blocks) {
        if (b.block_type === 'quiz_question') {
          list.push(b);
        }
      }
    }
    return list;
  }, [sections]);

  // Jump to specific block
  const handleJumpToBlock = (blockId: string) => {
    const el = document.getElementById(`block-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-sky-500');
      setTimeout(() => el.classList.remove('ring-2', 'ring-sky-500'), 2000);
    }
  };

  // Check quiz completion for celebratory confetti
  const answeredQuizCount = allQuizBlocks.filter((q) => guideQuizHistory[q.id]).length;
  const missedQuizCount = allQuizBlocks.filter(
    (q) => guideQuizHistory[q.id] && !guideQuizHistory[q.id].is_correct
  ).length;
  const isQuizComplete = allQuizBlocks.length > 0 && answeredQuizCount === allQuizBlocks.length;
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (isQuizComplete && missedQuizCount === 0 && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [isQuizComplete, missedQuizCount]);

  // Render a single block
  const renderBlock = (block: GuideBlock, sectionTitle: string) => {
    const bookmarked = isBlockBookmarked(block.id);

    return (
      <div key={block.id} id={`block-${block.id}`} className="relative group my-4">
        {/* Bookmark button */}
        {block.bookmarkable !== false && (
          <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() =>
                onToggleBookmark({
                  guide_id: guide.id,
                  guide_title: guide.title,
                  block_id: block.id,
                  block_type: block.block_type,
                  title: block.title,
                  phase: sectionTitle,
                  block,
                })
              }
              className={`p-1.5 rounded-lg border shadow-xs transition ${
                bookmarked
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-slate-400 hover:text-slate-800 border-slate-200'
              }`}
              title={bookmarked ? 'Remove Bookmark' : 'Bookmark Block'}
            >
              {bookmarked ? (
                <BookmarkCheck className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Dynamic block component rendering */}
        {block.block_type === 'markdown' && <MarkdownBlockView block={block} />}
        {block.block_type === 'code' && <CodeBlockView block={block} />}
        {block.block_type === 'kroki' && <KrokiBlockView block={block} />}
        {block.block_type === 'media' && <MediaBlockView block={block} />}
        {block.block_type === 'sandbox' && <SandboxBlockView block={block} />}
        {block.block_type === 'simulation' && <SimulationBlockView block={block} />}
        {block.block_type === 'reflection_rubric' && (
          <ReflectionRubricBlockView
            block={block}
            guideId={guide.id}
            initialNote={guideNotes[block.id] || ''}
            onSaveNote={(note) => onSaveReflectionNote(guide.id, block.id, note)}
          />
        )}
        {block.block_type === 'feynman_prompt' && (
          <FeynmanPromptBlockView
            block={block}
            guideTitle={guide.title}
            initialNote={guideNotes[block.id] || ''}
            onSaveNote={(note) => onSaveReflectionNote(guide.id, block.id, note)}
          />
        )}
        {block.block_type === 'quiz_question' && (
          <QuizBlockView
            block={block}
            previousAnswer={guideQuizHistory[block.id]}
            onAnswer={(selected, isCorrect) =>
              onRecordQuizAnswer(guide.id, block.id, selected, isCorrect, block, guide.title)
            }
            onResetAnswer={() => onResetQuizAnswer?.(guide.id, block.id)}
            onJumpToBlock={handleJumpToBlock}
          />
        )}
        {block.block_type === 'flashcard' && (
          <FlashcardBlockView
            block={block}
            guideId={guide.id}
            guideTitle={guide.title}
            isInSrsQueue={srsData?.items.some((i) => i.id === `${guide.id}:${block.id}`)}
            onRateSrs={
              onRateFlashcard
                ? (rating) => onRateFlashcard(guide.id, guide.title, block, rating)
                : undefined
            }
          />
        )}
      </div>
    );
  };

  // Generate Remediation Report Data
  const getRemediationReport = () => {
    const missed = allQuizBlocks
      .filter((q) => guideQuizHistory[q.id] && !guideQuizHistory[q.id].is_correct)
      .map((q) => ({
        question_id: q.id,
        question: q.question,
        selected_answer: guideQuizHistory[q.id].selected_answer,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        related_block_id: q.related_block_id,
      }));

    const correctCount = allQuizBlocks.length - missed.length;
    const accuracy = Math.round((correctCount / (allQuizBlocks.length || 1)) * 100);

    return {
      guide_id: guide.id,
      guide_title: guide.title,
      generated_at: new Date().toISOString(),
      timestamp: Date.now(),
      missed_questions: missed,
      reflection_notes: guideNotes,
      summary: {
        total_questions: allQuizBlocks.length,
        missed_count: missed.length,
        accuracy_percentage: accuracy,
      },
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Top Section Navigation */}
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-2 border-b border-slate-100 gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={onBack}
                className="flex items-center space-x-1 text-slate-500 hover:text-slate-900 text-xs font-medium flex-shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {guide.title}
              </h2>
              <button
                type="button"
                onClick={() => {
                  const shareUrl = `${window.location.origin}${window.location.pathname}#/guide/${encodeURIComponent(guide.id)}`;
                  navigator.clipboard.writeText(shareUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 1800);
                }}
                className="flex items-center space-x-1 px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-500 hover:text-slate-900 transition flex-shrink-0"
                title="Copy shareable link to this guide"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3 h-3" />
                    <span className="hidden md:inline">Share</span>
                  </>
                )}
              </button>
            </div>

            {/* Window Sizing & Notes Controls */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Width Sizing Control */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs text-slate-600 gap-0.5" title="Reading column width (or drag card borders)">
                <button
                  type="button"
                  onClick={() => handleSetWidth('compact')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    !customWidthPx && readerWidth === 'compact' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Narrow / Compact (768px)"
                >
                  Narrow
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWidth('standard')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    !customWidthPx && readerWidth === 'standard' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Normal Standard (896px)"
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWidth('wide')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    !customWidthPx && readerWidth === 'wide' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Wide Canvas (1152px)"
                >
                  Wide
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWidth('full')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    !customWidthPx && readerWidth === 'full' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Full Viewport Width"
                >
                  Full
                </button>
                {customWidthPx && (
                  <span className="px-2 py-0.5 rounded bg-white text-slate-800 shadow-2xs text-[10px] font-mono font-semibold">
                    {customWidthPx}px
                  </span>
                )}
              </div>

              {/* Font Size Scaler */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs text-slate-600" title="Reader Font Size">
                <button
                  type="button"
                  onClick={() => handleSetFontSize('base')}
                  className={`px-1.5 py-0.5 rounded text-[11px] transition ${
                    fontSize === 'base' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Standard 100% Font"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontSize('lg')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    fontSize === 'lg' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Large Font"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontSize('xl')}
                  className={`px-1.5 py-0.5 rounded text-[12px] font-bold transition ${
                    fontSize === 'xl' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title="Extra Large Font"
                >
                  A++
                </button>
              </div>

              {/* Side Notes Panel Toggle */}
              <button
                type="button"
                onClick={handleToggleSideNotes}
                className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-lg border transition relative ${
                  showSideNotes
                    ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
                title="Toggle Side Notes panel while studying"
              >
                <StickyNote className={`w-3.5 h-3.5 ${showSideNotes ? 'text-amber-600' : 'text-amber-500'}`} />
                <span className="hidden sm:inline font-sans">Notes</span>
                {Object.entries(guideNotes).some(
                  ([k, v]) => (k === '__guide_side_notes__' || k.startsWith('__section_side_note_')) && v.trim().length > 0
                ) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="You have saved notes in this guide" />
                )}
              </button>
            </div>
          </div>

          {/* Dynamic Section Navigation Bar & Progress Controls */}
          <div className="flex items-center justify-between py-2 border-t border-slate-100/80 gap-3">
            <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
              {sections.map((sec, idx) => {
                const isCompleted = completedSections.includes(sec.id);

                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                      const nextHash = `#/guide/${encodeURIComponent(guide.id)}?section=${encodeURIComponent(sec.id)}`;
                      if (window.location.hash !== nextHash) {
                        window.history.replaceState(null, '', nextHash);
                      }
                      const el = document.getElementById(`section-${sec.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs whitespace-nowrap transition"
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{sec.title}</span>
                    {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* User Progress Controls: Check All / Uncheck All / Reset */}
            <div className="flex items-center space-x-2 flex-shrink-0 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 hidden md:inline">
                {completedSections.length}/{sections.length} Done
              </span>

              {completedSections.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSetAllSectionsComplete?.(guide.id, sections.map((s) => s.id), false)}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-600 font-medium transition"
                  title="Uncheck all completed sections"
                >
                  Uncheck All
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetAllSectionsComplete?.(guide.id, sections.map((s) => s.id), true)}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-600 font-medium transition"
                  title="Mark all sections complete"
                >
                  Check All
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset all progress and quiz records for this guide?')) {
                    onResetGuideProgress?.(guide.id);
                  }
                }}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-[11px] text-slate-600 font-medium transition"
                title="Reset all progress, quiz history, and notes for this guide"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guide Content + Optional Side Notes Panel */}
      <div className="px-4 sm:px-6 pt-6">
        <div
          ref={containerRef}
          style={customWidthPx ? { maxWidth: `${customWidthPx}px` } : undefined}
          className={`relative mx-auto ${
            isDraggingResize ? 'select-none' : 'transition-all duration-200'
          } ${
            showSideNotes
              ? `${customWidthPx ? '' : 'max-w-[1440px]'} flex flex-col lg:flex-row gap-4 lg:gap-0 items-start`
              : customWidthPx
              ? ''
              : widthClass
          }`}
        >
          {/* Left Edge Drag Handle (Flush on visible card border) */}
          <div
            onPointerDown={(e) => startContainerDrag('left', e)}
            title="Drag border to resize reading width"
            className="hidden lg:flex absolute left-0 top-2 bottom-2 w-3 -ml-1.5 cursor-ew-resize items-center justify-center group z-20"
          >
            <div
              className={`w-1 h-16 rounded-full transition-colors ${
                isDraggingResize === 'container'
                  ? 'bg-slate-700'
                  : 'bg-transparent group-hover:bg-slate-400'
              }`}
            />
          </div>

          {/* Right Edge Drag Handle (Flush on visible card border) */}
          <div
            onPointerDown={(e) => startContainerDrag('right', e)}
            title="Drag border to resize reading width"
            className="hidden lg:flex absolute right-0 top-2 bottom-2 w-3 -mr-1.5 cursor-ew-resize items-center justify-center group z-20"
          >
            <div
              className={`w-1 h-16 rounded-full transition-colors ${
                isDraggingResize === 'container'
                  ? 'bg-slate-700'
                  : 'bg-transparent group-hover:bg-slate-400'
              }`}
            />
          </div>

          <main className={`${showSideNotes ? 'flex-1 min-w-0 w-full' : 'w-full'} ${fontSizeClass}`}>
        {/* Source Citations Banner if present */}
        {guide.sources && guide.sources.length > 0 && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-slate-800">
              <span className="font-semibold uppercase tracking-wider text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                Sources
              </span>
              <span className="text-slate-600">
                {guide.sources.map((s) => s.title).join(', ')}
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {guide.sources.map((src, i) => {
                const isExternal = /^https?:\/\//i.test(src.url_or_path);
                const href = isExternal
                  ? src.url_or_path
                  : `./${src.url_or_path.replace(/^\.\//, '').replace(/^\//, '')}`;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-medium transition shadow-2xs"
                    title={src.url_or_path}
                  >
                    {isExternal ? `${src.title} ↗` : src.title || 'View Source File'}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-10">
            {sections.map((sec, idx) => {
              const hasQuiz = sec.blocks.some((b) => b.block_type === 'quiz_question');

              return (
                <section
                  key={sec.id}
                  id={`section-${sec.id}`}
                  className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs"
                >
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900">{sec.title}</h3>
                    </div>

                    <button
                      onClick={() => onMarkPhaseComplete(guide.id, sec.id)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-xl border transition shadow-2xs ${
                        completedSections.includes(sec.id)
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 group'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                      }`}
                      title={
                        completedSections.includes(sec.id)
                          ? 'Click to uncheck / mark this section incomplete'
                          : 'Click to mark this section complete'
                      }
                    >
                      <CheckCircle
                        className={`w-3.5 h-3.5 ${
                          completedSections.includes(sec.id)
                            ? 'text-emerald-600 group-hover:text-rose-600'
                            : 'text-slate-400'
                        }`}
                      />
                      {completedSections.includes(sec.id) ? (
                        <>
                          <span className="group-hover:hidden">Completed</span>
                          <span className="hidden group-hover:inline">Uncheck</span>
                        </>
                      ) : (
                        <span>Mark Complete</span>
                      )}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sec.blocks.map((b) => renderBlock(b, sec.title))}
                  </div>

                  {/* If section contains quiz questions, show weak-spot remediation button */}
                  {hasQuiz && (
                    <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="text-xs text-slate-600">
                        <div className="font-semibold text-slate-800 mb-0.5">
                          Assessment Status: {answeredQuizCount} / {allQuizBlocks.length} Answered
                        </div>
                        {answeredQuizCount === allQuizBlocks.length && (
                          <span
                            className={`inline-block font-medium ${
                              missedQuizCount === 0 ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {missedQuizCount === 0
                              ? '🎉 Perfect Score! All concepts mastered.'
                              : `⚠️ ${missedQuizCount} concept gap(s) identified.`}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowRemediationModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Export Weak Spots</span>
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
      </main>

        {showSideNotes && (
          <>
            {/* Drag Splitter between Guide Content and Side Notes */}
            <div
              onPointerDown={startNotesSplitterDrag}
              title="Drag to resize Side Notes panel"
              className="hidden lg:flex w-5 self-stretch cursor-col-resize items-start justify-center pt-28 flex-shrink-0 group"
            >
              <div
                className={`w-1 h-24 rounded-full transition-colors ${
                  isDraggingResize === 'notes'
                    ? 'bg-amber-500'
                    : 'bg-slate-200 group-hover:bg-amber-400'
                }`}
              />
            </div>
            <SideNotesPanel
              guideTitle={guide.title}
              activeSectionId={activeSection?.id || 'general'}
              activeSectionTitle={activeSection?.title || guide.title}
              notesMap={guideNotes}
              onSaveNote={(noteKey, value) => onSaveReflectionNote(guide.id, noteKey, value)}
              onClose={handleToggleSideNotes}
              widthPx={sideNotesWidthPx}
              onChangeWidthPx={handleUpdateSideNotesWidth}
            />
          </>
        )}
        </div>
      </div>

      {/* Weak Spots Remediation Modal */}
      {showRemediationModal && (
        <WeakSpotModal report={getRemediationReport()} onClose={() => setShowRemediationModal(false)} />
      )}
    </div>
  );
};
