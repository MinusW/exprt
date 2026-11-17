import React, { useState, useMemo } from 'react';
import {
  BrainCircuit,
  Download,
  CheckCircle,
  XCircle,
  Star,
  Flame,
  Calendar,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SrsItem, UserSrsData, UserProgressData } from '../types.js';
import { MathText } from './MathText.js';
import { shuffleOptions } from '../utils/shuffle.js';

interface Props {
  srsData: UserSrsData;
  progress?: UserProgressData;
  onReviewItem: (itemId: string, rating: 1 | 2 | 3 | 4) => void;
  onBackToDashboard: () => void;
}

export const SrsReviewView: React.FC<Props> = ({
  srsData,
  progress,
  onReviewItem,
  onBackToDashboard,
}) => {
  const now = Date.now();
  const dueItems = srsData.items.filter((item) => item.due_date <= now);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [selectedSingleOption, setSelectedSingleOption] = useState<string | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [revealedHintsCount, setRevealedHintsCount] = useState(0);
  const [isWideView, setIsWideView] = useState(false);
  const [showAnalyticsDetails, setShowAnalyticsDetails] = useState(true);

  const currentItem: SrsItem | undefined = dueItems[currentIndex];

  const currentItemOptions = useMemo(() => {
    if (!currentItem?.question?.options) return [];
    return shuffleOptions(currentItem.question.options);
  }, [currentItem?.id, currentItem?.question?.options]);

  const itemHints: string[] = useMemo(() => {
    if (!currentItem) return [];
    if (currentItem.question?.hints && currentItem.question.hints.length > 0) {
      return currentItem.question.hints;
    }
    const single = currentItem.flashcard?.hint || currentItem.hint;
    return single ? [single] : [];
  }, [currentItem]);

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    if (!currentItem) return;
    onReviewItem(currentItem.id, rating);
    setIsAnswerRevealed(false);
    setSelectedSingleOption(null);
    setSelectedMultiOptions([]);
    setRevealedHintsCount(0);
    if (currentIndex >= dueItems.length - 1) {
      setCurrentIndex(0);
    }
  };

  // Export to Anki TSV
  const handleExportToAnki = () => {
    if (srsData.items.length === 0) {
      alert('No cards available in your spaced repetition deck yet.');
      return;
    }

    const tsvRows = [
      '#separator:tab',
      '#html:true',
      '#tags column:3',
      ...srsData.items.map((item) => {
        let frontHtml = `<strong>${item.guide_title}</strong><br/>`;
        let backHtml = '';

        if (item.flashcard) {
          frontHtml += item.flashcard.front.replace(/\n/g, '<br/>');
          if (item.flashcard.hint) {
            frontHtml += `<br/><br/><small><i>Hint: ${item.flashcard.hint.replace(/\n/g, '<br/>')}</i></small>`;
          }
          backHtml = item.flashcard.back.replace(/\n/g, '<br/>');
        } else if (item.question) {
          frontHtml += item.question.question.replace(/\n/g, '<br/>');
          if (item.question.options && item.question.options.length > 0) {
            frontHtml += '<br/><br/>' + shuffleOptions(item.question.options).map((opt) => `• ${opt}`).join('<br/>');
          }
          if (item.question.hints && item.question.hints.length > 0) {
            frontHtml += `<br/><br/><small><i>Hint: ${item.question.hints[0].replace(/\n/g, '<br/>')}</i></small>`;
          }
          const answer = Array.isArray(item.question.correct_answer)
            ? item.question.correct_answer.join(', ')
            : item.question.correct_answer;
          const explanation = item.question.explanation
            ? `<br/><br/><i>${item.question.explanation.replace(/\n/g, '<br/>')}</i>`
            : '';
          backHtml = `<b>Answer:</b> ${answer}${explanation}`;
        } else {
          frontHtml += (item.front || '').replace(/\n/g, '<br/>');
          backHtml = (item.back || '').replace(/\n/g, '<br/>');
        }

        const tags = `study_guide ${item.guide_id}`;
        return `${frontHtml.replace(/\t/g, ' ')}\t${backHtml.replace(/\t/g, ' ')}\t${tags}`;
      }),
    ];

    const blob = new Blob([tsvRows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `antigravity_srs_anki_deck_${Date.now()}.tsv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 30-Day Activity Heatmap & Streak Calculation
  const { heatmapDays, currentStreak, retentionRate, stats } = useMemo(() => {
    const days: { dateStr: string; label: string; count: number; date: Date }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Collect timestamps from quiz attempts and SRS reviews
    const activityTimestamps: number[] = [];

    if (progress?.quiz_history) {
      for (const guideId in progress.quiz_history) {
        for (const qId in progress.quiz_history[guideId]) {
          const attempt = progress.quiz_history[guideId][qId];
          if (attempt.answered_at) {
            activityTimestamps.push(attempt.answered_at);
          }
        }
      }
    }

    for (const item of srsData.items) {
      if (item.last_review) {
        activityTimestamps.push(item.last_review);
      }
    }

    // Build 30-day window
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const startMs = d.getTime();
      const endMs = startMs + 24 * 60 * 60 * 1000 - 1;

      const count = activityTimestamps.filter((ts) => ts >= startMs && ts <= endMs).length;
      days.push({
        dateStr: d.toISOString().split('T')[0],
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count,
        date: d,
      });
    }

    // Calculate current streak
    let streak = 0;
    const todayIndex = days.length - 1;
    const todayCount = days[todayIndex]?.count || 0;
    const yesterdayCount = days[todayIndex - 1]?.count || 0;

    let checkIndex = todayIndex;
    if (todayCount === 0 && yesterdayCount > 0) {
      checkIndex = todayIndex - 1;
    }

    while (checkIndex >= 0 && days[checkIndex].count > 0) {
      streak++;
      checkIndex--;
    }

    // Retention rate
    let totalQuestions = 0;
    let firstAttemptCorrect = 0;
    if (progress?.quiz_history) {
      for (const guideId in progress.quiz_history) {
        for (const qId in progress.quiz_history[guideId]) {
          const attempt = progress.quiz_history[guideId][qId];
          totalQuestions++;
          if (attempt.attempts === 1 && attempt.is_correct) {
            firstAttemptCorrect++;
          }
        }
      }
    }

    const retention = totalQuestions > 0 ? Math.round((firstAttemptCorrect / totalQuestions) * 100) : 100;

    // Deck breakdown
    const learningCount = srsData.items.filter((i) => i.state === 'learning').length;
    const reviewCount = srsData.items.filter((i) => i.state === 'review').length;
    const relearningCount = srsData.items.filter((i) => i.state === 'relearning').length;
    const matureCount = srsData.items.filter((i) => (i.interval || 0) >= 21).length;

    return {
      heatmapDays: days,
      currentStreak: streak,
      retentionRate: retention,
      stats: {
        totalCards: srsData.items.length,
        learningCount,
        reviewCount,
        relearningCount,
        matureCount,
      },
    };
  }, [srsData, progress]);

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 transition-all duration-200 ${isWideView ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <BrainCircuit className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Daily Spaced Repetition (FSRS)
            </h1>
            {currentStreak > 0 && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 shadow-2xs">
                <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>{currentStreak} Day Streak</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Active recall and spaced repetition for quiz questions and flashcards to build permanent mental models.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsWideView(!isWideView)}
            className="flex items-center space-x-1 px-2.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs"
            title={isWideView ? 'Standard Width' : 'Enlarge Window'}
          >
            {isWideView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isWideView ? 'Standard' : 'Enlarge'}</span>
          </button>

          <button
            onClick={handleExportToAnki}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Export to Anki (TSV)</span>
          </button>
        </div>
      </div>

      {/* SRS Analytics & 30-Day Activity Heatmap Grid */}
      <div className="mb-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Retention & Study Habit Analytics
            </h3>
          </div>

          <button
            onClick={() => setShowAnalyticsDetails(!showAnalyticsDetails)}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
          >
            <span>{showAnalyticsDetails ? 'Collapse' : 'Expand'}</span>
            {showAnalyticsDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Top Summary Stat Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Current Streak</span>
            <div className="text-lg font-bold text-amber-600 flex items-center space-x-1 mt-0.5">
              <Flame className="w-4 h-4 fill-amber-500" />
              <span>{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Due for Review</span>
            <div className="text-lg font-bold text-indigo-600 mt-0.5">
              {dueItems.length} <span className="text-xs text-slate-400 font-normal">/ {stats.totalCards} cards</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">First-Pass Retention</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">
              {retentionRate}%
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Mature Cards (21d+)</span>
            <div className="text-lg font-bold text-slate-800 mt-0.5">
              {stats.matureCount}
            </div>
          </div>
        </div>

        {showAnalyticsDetails && (
          <div>
            {/* 30-Day Heatmap Grid */}
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">30-Day Practice Activity Heatmap:</span>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span>Less</span>
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200"></span>
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100"></span>
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300"></span>
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span>More</span>
              </div>
            </div>

            <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              {heatmapDays.map((d, idx) => {
                let color = 'bg-slate-100 text-slate-400 border border-slate-200/50';
                if (d.count >= 6) color = 'bg-emerald-600 text-white font-bold shadow-2xs';
                else if (d.count >= 3) color = 'bg-emerald-400 text-emerald-950 font-semibold';
                else if (d.count >= 1) color = 'bg-emerald-200 text-emerald-900';

                return (
                  <div
                    key={idx}
                    className={`h-9 rounded-lg flex flex-col items-center justify-center text-[10px] transition transform hover:scale-110 cursor-default ${color}`}
                    title={`${d.dateStr}: ${d.count} reviews & quiz attempts`}
                  >
                    <span className="text-[8px] opacity-75">{d.label.split(' ')[1]}</span>
                    <span>{d.count > 0 ? d.count : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Review Section */}
      {dueItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">You're All Caught Up!</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            There are no spaced repetition cards due for review right now. Complete more study guides or check back tomorrow!
          </p>
          <div className="text-xs text-slate-400 font-mono mb-4">
            Total active cards in system: {srsData.items.length}
          </div>
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            Return to Curriculum
          </button>
        </div>
      ) : currentItem ? (
        <div>
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
            <span>
              Card {currentIndex + 1} of {dueItems.length} Due Today
            </span>
            <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
              From: {currentItem.guide_title}
            </span>
          </div>

          {/* Flashcard Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 min-h-[320px] flex flex-col justify-between">
            <div>
              {/* Question / Card Header */}
              <div className="flex items-center justify-between text-xs text-slate-400 mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-1.5">
                  {currentItem.item_type === 'flashcard' || currentItem.flashcard ? (
                    <span className="uppercase tracking-wider font-semibold text-indigo-600 flex items-center space-x-1">
                      <Layers className="w-3.5 h-3.5 mr-1" />
                      <span>Flashcard Prompt</span>
                    </span>
                  ) : (
                    <span className="uppercase tracking-wider font-semibold text-slate-500">
                      Quiz Question (Level {currentItem.question?.difficulty || 3})
                    </span>
                  )}
                </div>

                {currentItem.question && (
                  <div className="flex space-x-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < (currentItem.question?.difficulty || 3)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200 fill-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Front Content */}
              <MathText
                text={
                  currentItem.flashcard?.front ||
                  currentItem.front ||
                  currentItem.question?.question ||
                  ''
                }
                className="text-slate-900 text-sm sm:text-base font-medium leading-relaxed"
              />

              {/* Interactive Options if quiz question */}
              {currentItemOptions.length > 0 && (() => {
                const isMultiSelect = currentItem.question?.question_type === 'multi_select';
                const correctRaw = currentItem.question?.correct_answer;
                const correctList = Array.isArray(correctRaw)
                  ? correctRaw.map((c) => c.trim().toLowerCase())
                  : [String(correctRaw ?? '').trim().toLowerCase()];

                return (
                  <div className="mt-4 space-y-2">
                    {isMultiSelect && (
                      <span className="text-[11px] text-slate-500 block">
                        (Select all that apply)
                      </span>
                    )}
                    {currentItemOptions.map((opt, i) => {
                      const isOptionCorrect = correctList.includes(opt.trim().toLowerCase());
                      const isSelected = isMultiSelect
                        ? selectedMultiOptions.includes(opt)
                        : selectedSingleOption === opt;

                      let style =
                        'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800';
                      if (isAnswerRevealed) {
                        if (isOptionCorrect) {
                          style = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium';
                        } else if (isSelected) {
                          style = 'border-rose-400 bg-rose-50 text-rose-950';
                        } else {
                          style = 'opacity-60 border-slate-200 bg-white text-slate-600';
                        }
                      } else if (isSelected) {
                        style = 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-400 text-slate-900';
                      }

                      return (
                        <button
                          key={`${i}-${opt}`}
                          type="button"
                          disabled={isAnswerRevealed}
                          onClick={() => {
                            if (isAnswerRevealed) return;
                            if (isMultiSelect) {
                              setSelectedMultiOptions((prev) =>
                                prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
                              );
                            } else {
                              setSelectedSingleOption(opt);
                              setIsAnswerRevealed(true);
                            }
                          }}
                          className={`w-full text-left p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm transition flex items-center justify-between ${style}`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {isMultiSelect && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="rounded text-amber-600 border-slate-300 pointer-events-none"
                              />
                            )}
                            <MathText text={opt} as="span" className="leading-snug" />
                          </div>
                          {isAnswerRevealed && isOptionCorrect && (
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                          )}
                          {isAnswerRevealed && isSelected && !isOptionCorrect && (
                            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}

                    {isMultiSelect && !isAnswerRevealed && selectedMultiOptions.length > 0 && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setIsAnswerRevealed(true)}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs"
                        >
                          Check Answers
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Socratic Hint if available */}
              {itemHints.length > 0 && (
                <div className="mt-4">
                  {revealedHintsCount < itemHints.length && (
                    <button
                      type="button"
                      onClick={() => setRevealedHintsCount((prev) => prev + 1)}
                      className="inline-flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {revealedHintsCount === 0
                          ? `Need a hint? (Reveal 1 of ${itemHints.length})`
                          : `Reveal next hint (${revealedHintsCount + 1} of ${itemHints.length})`}
                      </span>
                    </button>
                  )}

                  {revealedHintsCount > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {itemHints.slice(0, revealedHintsCount).map((hint, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900"
                        >
                          <div className="flex items-center space-x-1 font-bold text-amber-800 mb-0.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                            <span>Socratic Hint {itemHints.length > 1 ? `${idx + 1}` : ''}:</span>
                          </div>
                          <MathText text={hint} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Answer Drawer */}
            {isAnswerRevealed ? (
              <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-xs font-bold text-emerald-900 block mb-1">
                    {currentItem.item_type === 'flashcard' || currentItem.flashcard ? 'Core Concept Answer:' : 'Correct Answer:'}
                  </span>
                  <div className="text-emerald-950 font-semibold text-sm">
                    <MathText
                      text={
                        currentItem.flashcard?.back ||
                        currentItem.back ||
                        (Array.isArray(currentItem.question?.correct_answer)
                          ? currentItem.question.correct_answer.join(', ')
                          : String(currentItem.question?.correct_answer || ''))
                      }
                      as="div"
                    />
                  </div>
                </div>

                {currentItem.question?.explanation && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold text-slate-800 block mb-1">Explanation:</span>
                    <MathText text={currentItem.question.explanation} />
                  </div>
                )}

                {/* FSRS Rating Buttons */}
                <div className="pt-2">
                  <span className="text-[11px] text-slate-500 font-medium block text-center mb-2">
                    How well did you recall this answer?
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleRate(1)}
                      className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold flex flex-col items-center transition"
                    >
                      <span>Again</span>
                      <span className="text-[10px] text-rose-500 font-normal">&lt; 1 day</span>
                    </button>
                    <button
                      onClick={() => handleRate(2)}
                      className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex flex-col items-center transition"
                    >
                      <span>Hard</span>
                      <span className="text-[10px] text-amber-500 font-normal">~ 1-2 days</span>
                    </button>
                    <button
                      onClick={() => handleRate(3)}
                      className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex flex-col items-center transition"
                    >
                      <span>Good</span>
                      <span className="text-[10px] text-blue-500 font-normal">~ 3-4 days</span>
                    </button>
                    <button
                      onClick={() => handleRate(4)}
                      className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex flex-col items-center transition"
                    >
                      <span>Easy</span>
                      <span className="text-[10px] text-emerald-500 font-normal">~ 7+ days</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-center">
                <button
                  onClick={() => setIsAnswerRevealed(true)}
                  className="px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                >
                  Show Answer & Explanation
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
