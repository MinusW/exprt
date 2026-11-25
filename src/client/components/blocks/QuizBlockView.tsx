import React, { useMemo, useState } from 'react';
import { HelpCircle, CheckCircle, XCircle, Star, ArrowUpRight, AlertCircle, Lightbulb, RotateCcw } from 'lucide-react';
import type { QuizQuestionBlock } from '../../types.js';
import { MathText } from '../MathText.js';
import { RichMarkdown } from '../RichMarkdown.js';
import { KrokiBlockView } from './KrokiBlockView.js';
import { shuffleOptions } from '../../utils/shuffle.js';

interface Props {
  block: QuizQuestionBlock;
  previousAnswer?: {
    selected_answer: string | string[];
    is_correct: boolean;
  };
  onAnswer: (selected: string | string[], isCorrect: boolean) => void;
  onResetAnswer?: () => void;
  onJumpToBlock?: (blockId: string) => void;
}

export const QuizBlockView: React.FC<Props> = ({
  block,
  previousAnswer,
  onAnswer,
  onResetAnswer,
  onJumpToBlock,
}) => {
  const [selectedSingle, setSelectedSingle] = useState<string>(
    typeof previousAnswer?.selected_answer === 'string' ? previousAnswer.selected_answer : ''
  );
  const [selectedMulti, setSelectedMulti] = useState<string[]>(
    Array.isArray(previousAnswer?.selected_answer) ? previousAnswer.selected_answer : []
  );
  const [textInput, setTextInput] = useState<string>(
    typeof previousAnswer?.selected_answer === 'string' ? previousAnswer.selected_answer : ''
  );
  const [isSubmitted, setIsSubmitted] = useState<boolean>(Boolean(previousAnswer));
  const [revealedHintsCount, setRevealedHintsCount] = useState<number>(0);
  const [attemptSeed, setAttemptSeed] = useState<number>(0);

  const shuffledOptions = useMemo(
    () => (block.options ? shuffleOptions(block.options) : []),
    [block.id, block.options, attemptSeed]
  );

  // Determine correctness
  const isCorrect = previousAnswer ? previousAnswer.is_correct : (() => {
    if (block.question_type === 'multi_select') {
      const correctArr = Array.isArray(block.correct_answer)
        ? block.correct_answer
        : [block.correct_answer];
      if (selectedMulti.length !== correctArr.length) return false;
      const sortedA = [...selectedMulti].sort();
      const sortedB = [...correctArr].sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    }
    const cleanUser = (typeof block.question_type === 'string' && ['fill_in_the_blank', 'code_output', 'short_answer'].includes(block.question_type))
      ? textInput.trim().toLowerCase()
      : selectedSingle.trim().toLowerCase();

    const cleanExpected = Array.isArray(block.correct_answer)
      ? block.correct_answer.map((s) => s.trim().toLowerCase())
      : [String(block.correct_answer).trim().toLowerCase()];

    return cleanExpected.includes(cleanUser);
  })();

  const handleSelectSingle = (option: string) => {
    if (isSubmitted) return;
    setSelectedSingle(option);
    const cleanExpected = Array.isArray(block.correct_answer)
      ? block.correct_answer.map((s) => s.trim().toLowerCase())
      : [String(block.correct_answer).trim().toLowerCase()];
    const correct = cleanExpected.includes(option.trim().toLowerCase());
    setIsSubmitted(true);
    onAnswer(option, correct);
  };

  const handleToggleMulti = (option: string) => {
    if (isSubmitted) return;
    setSelectedMulti((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleSubmitMulti = () => {
    if (isSubmitted || selectedMulti.length === 0) return;
    const correctArr = Array.isArray(block.correct_answer)
      ? block.correct_answer.map((s) => s.trim().toLowerCase())
      : [String(block.correct_answer).trim().toLowerCase()];

    const userSelected = selectedMulti.map((s) => s.trim().toLowerCase());
    const correct =
      userSelected.length === correctArr.length &&
      userSelected.every((item) => correctArr.includes(item));

    setIsSubmitted(true);
    onAnswer(selectedMulti, correct);
  };

  const handleSubmitText = () => {
    if (isSubmitted || !textInput.trim()) return;
    const cleanUser = textInput.trim().toLowerCase();
    const cleanExpected = Array.isArray(block.correct_answer)
      ? block.correct_answer.map((s) => s.trim().toLowerCase())
      : [String(block.correct_answer).trim().toLowerCase()];
    const correct = cleanExpected.includes(cleanUser);

    setIsSubmitted(true);
    onAnswer(textInput.trim(), correct);
  };

  const handleRetry = () => {
    setIsSubmitted(false);
    setSelectedSingle('');
    setSelectedMulti([]);
    setTextInput('');
    setAttemptSeed((s) => s + 1);
    if (onResetAnswer) {
      onResetAnswer();
    }
  };

  return (
    <div
      id={`block-${block.id}`}
      className={`my-6 border rounded-xl bg-white shadow-sm overflow-hidden transition-all ${
        isSubmitted
          ? isCorrect
            ? 'border-emerald-300 ring-1 ring-emerald-200'
            : 'border-rose-300 ring-1 ring-rose-200'
          : 'border-slate-200'
      }`}
    >
      {/* Quiz Question Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/70 border-b border-amber-100">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-slate-800 text-xs sm:text-sm">
            {block.title || 'Check Your Understanding'}
          </span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800">
            {block.question_type.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Difficulty stars */}
        <div className="flex items-center space-x-1" title={`Difficulty: ${block.difficulty}/5`}>
          <span className="text-[10px] text-slate-500 mr-1 hidden sm:inline">Level</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${
                i < block.difficulty
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200 fill-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Question Text */}
        <MathText
          text={block.question}
          className="text-slate-900 font-medium text-xs sm:text-sm leading-relaxed mb-4"
        />

        {/* Socratic Hint Ladder */}
        {block.hints && block.hints.length > 0 && (
          <div className="mb-4">
            {revealedHintsCount < block.hints.length && (
              <button
                type="button"
                onClick={() => setRevealedHintsCount((prev) => prev + 1)}
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-3 py-1.5 rounded-xl transition"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {revealedHintsCount === 0
                    ? `Need a hint? (Reveal 1 of ${block.hints.length})`
                    : `Reveal next hint (${revealedHintsCount + 1} of ${block.hints.length})`}
                </span>
              </button>
            )}

            {revealedHintsCount > 0 && (
              <div className="mt-2.5 space-y-2">
                {block.hints.slice(0, revealedHintsCount).map((hint, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 animate-fadeIn"
                  >
                    <div className="font-semibold text-amber-900 mb-0.5 flex items-center space-x-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>Socratic Hint {idx + 1}:</span>
                    </div>
                    <MathText text={hint} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Question Options */}
        {/* 1. Multiple Choice */}
        {block.question_type === 'multiple_choice' && shuffledOptions.length > 0 && (
          <div className="space-y-2">
            {shuffledOptions.map((option, idx) => {
              const isSelected = selectedSingle === option;
              const isOptionCorrect = Array.isArray(block.correct_answer)
                ? block.correct_answer.includes(option)
                : block.correct_answer === option;

              let style = 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50';
              if (isSubmitted) {
                if (isOptionCorrect) {
                  style = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium';
                } else if (isSelected) {
                  style = 'border-rose-400 bg-rose-50 text-rose-950';
                } else {
                  style = 'opacity-60 border-slate-200 bg-white';
                }
              } else if (isSelected) {
                style = 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-400';
              }

              return (
                <button
                  key={`${idx}-${option}`}
                  onClick={() => handleSelectSingle(option)}
                  disabled={isSubmitted}
                  className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition flex items-center justify-between ${style}`}
                >
                  <MathText text={option} as="span" className="leading-snug" />
                  {isSubmitted && isOptionCorrect && (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                  )}
                  {isSubmitted && isSelected && !isOptionCorrect && (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Multi Select */}
        {block.question_type === 'multi_select' && shuffledOptions.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] text-slate-500 mb-1 block">
              (Select all that apply)
            </span>
            {shuffledOptions.map((option, idx) => {
              const isSelected = selectedMulti.includes(option);
              const isOptionCorrect = Array.isArray(block.correct_answer)
                ? block.correct_answer.includes(option)
                : block.correct_answer === option;

              let style = 'border-slate-200 bg-white';
              if (isSubmitted) {
                if (isOptionCorrect) {
                  style = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium';
                } else if (isSelected) {
                  style = 'border-rose-400 bg-rose-50 text-rose-950';
                } else {
                  style = 'opacity-60 border-slate-200 bg-white';
                }
              } else if (isSelected) {
                style = 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-400';
              }

              return (
                <div
                  key={`${idx}-${option}`}
                  onClick={() => handleToggleMulti(option)}
                  className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition flex items-center justify-between cursor-pointer ${style}`}
                >
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isSubmitted}
                      onChange={() => {}}
                      className="rounded text-amber-600 border-slate-300"
                    />
                    <MathText text={option} as="span" className="leading-snug" />
                  </div>
                  {isSubmitted && isOptionCorrect && (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                  )}
                </div>
              );
            })}

            {!isSubmitted && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSubmitMulti}
                  disabled={selectedMulti.length === 0}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white transition shadow-sm"
                >
                  Confirm Answers
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. Fill in the blank / Code output / Short answer */}
        {(block.question_type === 'fill_in_the_blank' ||
          block.question_type === 'code_output' ||
          block.question_type === 'short_answer') && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={isSubmitted}
                placeholder="Type your answer here..."
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitText()}
                className={`flex-1 p-2.5 text-xs sm:text-sm rounded-xl border outline-none font-mono ${
                  isSubmitted
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                      : 'border-rose-400 bg-rose-50 text-rose-950'
                    : 'border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 bg-white'
                }`}
              />
              {!isSubmitted && (
                <button
                  onClick={handleSubmitText}
                  disabled={!textInput.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white transition shadow-sm whitespace-nowrap"
                >
                  Submit Answer
                </button>
              )}
            </div>

            {isSubmitted && !isCorrect && (
              <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800">Expected answer: </span>
                <MathText
                  text={
                    Array.isArray(block.correct_answer)
                      ? block.correct_answer.join(' OR ')
                      : String(block.correct_answer)
                  }
                  as="span"
                  className="font-mono text-indigo-700"
                />
              </div>
            )}
          </div>
        )}

        {/* Feedback & Detailed Explanation */}
        {isSubmitted && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed mb-3 ${
                isCorrect
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold mb-1.5">
                {isCorrect ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Correct!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Not quite right</span>
                  </>
                )}
              </div>
              <RichMarkdown content={block.explanation} className="text-slate-800" />
            </div>

            {block.explanation_diagram && (
              <div className="mb-3">
                <KrokiBlockView
                  block={{
                    id: `${block.id}-explanation-diagram`,
                    block_type: 'kroki',
                    diagram_type: block.explanation_diagram.diagram_type,
                    title: block.explanation_diagram.title || 'Visual Explanation',
                    source: block.explanation_diagram.source,
                    caption: block.explanation_diagram.caption,
                    bookmarkable: false,
                  }}
                />
              </div>
            )}

            {/* Links and retry button */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {block.related_block_id && (
                <button
                  onClick={() => onJumpToBlock && onJumpToBlock(block.related_block_id)}
                  className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-medium underline"
                >
                  <span>Review related concept in guide</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={handleRetry}
                className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 font-medium underline ml-auto transition"
                title="Clear your answer and re-attempt this question"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isCorrect ? 'Re-attempt Question' : 'Try Again'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
