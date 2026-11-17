import React, { useState } from 'react';
import { Layers, Lightbulb, RotateCw, CheckCircle2, Star, Sparkles } from 'lucide-react';
import type { FlashcardBlock } from '../../types.js';
import { MathText } from '../MathText.js';

interface Props {
  block: FlashcardBlock;
  guideId?: string;
  guideTitle?: string;
  onRateSrs?: (rating: 1 | 2 | 3 | 4) => void;
  isInSrsQueue?: boolean;
}

export const FlashcardBlockView: React.FC<Props> = ({
  block,
  guideId: _guideId,
  guideTitle: _guideTitle,
  onRateSrs,
  isInSrsQueue = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [ratedRating, setRatedRating] = useState<number | null>(null);

  const handleRate = (rating: 1 | 2 | 3 | 4, e: React.MouseEvent) => {
    e.stopPropagation();
    setRatedRating(rating);
    if (onRateSrs) {
      onRateSrs(rating);
    }
  };

  return (
    <div className="my-5 select-none">
      <div
        className={`relative rounded-2xl border transition-all duration-300 shadow-xs hover:shadow-md ${
          isFlipped
            ? 'bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 border-indigo-200'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100/80 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-800">
              {block.title || 'Flashcard'}
            </span>
            {block.tags && block.tags.length > 0 && (
              <div className="hidden sm:flex items-center space-x-1 ml-2">
                {block.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isInSrsQueue && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>In SRS Deck</span>
              </span>
            )}
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Flip Card"
            >
              <RotateCw className={`w-3.5 h-3.5 transform transition-transform ${isFlipped ? 'rotate-180' : ''}`} />
              <span>{isFlipped ? 'Show Front' : 'Flip to Answer'}</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="p-6 sm:p-8 cursor-pointer min-h-[170px] flex flex-col justify-between"
        >
          {!isFlipped ? (
            /* Front side */
            <div className="space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Concept / Prompt</span>
              </div>
              <MathText
                text={block.front}
                className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed"
              />

              {block.hint && (
                <div className="pt-2">
                  {!showHint ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(true);
                      }}
                      className="inline-flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>Need a hint?</span>
                    </button>
                  ) : (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900"
                    >
                      <div className="flex items-center space-x-1.5 font-bold mb-1 text-amber-800">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>Socratic Hint:</span>
                      </div>
                      <MathText text={block.hint} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Back side */
            <div className="space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center space-x-1">
                <Star className="w-3.5 h-3.5" />
                <span>Answer & Core Mental Model</span>
              </div>
              <div className="p-4 bg-white/80 rounded-xl border border-indigo-100 text-slate-800">
                <MathText
                  text={block.back}
                  className="text-sm sm:text-base leading-relaxed font-normal"
                />
              </div>

              {/* SRS Rating Actions */}
              {onRateSrs && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-3 border-t border-indigo-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Rate Recall Difficulty (FSRS):
                    </span>
                    {ratedRating && (
                      <span className="text-xs text-emerald-600 font-medium flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Scheduled!</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleRate(1, e)}
                      className={`p-2 rounded-xl text-xs font-semibold transition border ${
                        ratedRating === 1
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                      }`}
                    >
                      Again
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRate(2, e)}
                      className={`p-2 rounded-xl text-xs font-semibold transition border ${
                        ratedRating === 2
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      Hard
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRate(3, e)}
                      className={`p-2 rounded-xl text-xs font-semibold transition border ${
                        ratedRating === 3
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                      }`}
                    >
                      Good
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRate(4, e)}
                      className={`p-2 rounded-xl text-xs font-semibold transition border ${
                        ratedRating === 4
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      Easy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Flip Hint */}
          <div className="pt-3 mt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Click card to {isFlipped ? 'flip back' : 'reveal answer'}</span>
            <span className="font-mono text-[10px] text-slate-400">
              {isFlipped ? 'BACK' : 'FRONT'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
