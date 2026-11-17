import React, { useState } from 'react';
import { PenTool, CheckCircle, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react';
import type { ReflectionRubricBlock } from '../../types.js';
import { MathText } from '../MathText.js';

interface Props {
  block: ReflectionRubricBlock;
  guideId: string;
  initialNote?: string;
  onSaveNote: (note: string) => void;
}

export const ReflectionRubricBlockView: React.FC<Props> = ({
  block,
  initialNote = '',
  onSaveNote,
}) => {
  const [note, setNote] = useState(initialNote);
  const [isSubmitted, setIsSubmitted] = useState(Boolean(initialNote.trim().length > 0));
  const [checkedCriteria, setCheckedCriteria] = useState<Record<number, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSubmit = () => {
    if (!note.trim()) return;
    setIsSubmitted(true);
    onSaveNote(note);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
    onSaveNote(e.target.value);
  };

  const toggleCriterion = (idx: number) => {
    setCheckedCriteria((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="my-6 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <PenTool className="w-4 h-4 text-slate-700" />
          <span className="font-semibold text-slate-800 text-xs sm:text-sm">
            {block.title || 'Structured Reflection & Synthesis'}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded">
          {isSubmitted ? (
            <>
              <Unlock className="w-3 h-3 text-emerald-600" />
              <span>Rubric Unlocked</span>
            </>
          ) : (
            <>
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Submit draft to unlock rubric</span>
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Synthesis Prompt */}
        <MathText
          text={block.prompt}
          className="mb-3 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed"
        />

        {/* Scratchpad Textarea */}
        <div className="my-3">
          <textarea
            value={note}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const target = e.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const next = note.slice(0, start) + '  ' + note.slice(end);
                setNote(next);
                onSaveNote(next);
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start + 2;
                });
              }
            }}
            placeholder="Type your reflection, synthesis, or answers here before viewing the rubric..."
            rows={5}
            className="w-full p-3 text-xs sm:text-sm text-slate-800 border border-slate-200 rounded-xl focus:border-slate-500 focus:ring-2 focus:ring-slate-200 outline-none leading-relaxed resize-y bg-slate-50/40"
          />
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
            <span className="text-[11px] text-slate-400">Auto-saved to local progress file</span>
            {note.trim() && (
              <button
                type="button"
                onClick={() => {
                  setNote('');
                  setIsSubmitted(false);
                  setCheckedCriteria({});
                  onSaveNote('');
                }}
                className="text-[11px] text-slate-400 hover:text-rose-600 underline transition"
                title="Clear draft and reset self-assessment"
              >
                Clear Notes
              </button>
            )}
          </div>
        </div>

        {/* Submit / Unlock Button */}
        {!isSubmitted && (
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!note.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white transition shadow-sm"
            >
              Submit Draft & Unlock Model Answer
            </button>
          </div>
        )}

        {/* Unlocked Rubric and Model Answer */}
        {isSubmitted && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Self-Assessment Checklist & Model Answer</span>
              </span>
              <div className="flex items-center space-x-2">
                {Object.values(checkedCriteria).some(Boolean) && (
                  <button
                    type="button"
                    onClick={() => setCheckedCriteria({})}
                    className="text-[11px] text-slate-400 hover:text-slate-700 underline transition"
                    title="Uncheck all criteria"
                  >
                    Uncheck All
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-slate-500 hover:text-slate-800 p-1"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-4">
                {/* Self-check criteria */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-800 block mb-2">
                    Did your explanation address all of these key elements?
                  </span>
                  <div className="space-y-2">
                    {block.self_check_criteria.map((criterion, idx) => (
                      <label
                        key={idx}
                        className="flex items-start space-x-2.5 text-xs text-slate-700 cursor-pointer select-none hover:text-slate-900"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checkedCriteria[idx])}
                          onChange={() => toggleCriterion(idx)}
                          className="mt-0.5 rounded text-slate-800 focus:ring-slate-400 border-slate-300"
                        />
                        <MathText
                          text={criterion}
                          as="span"
                          className={checkedCriteria[idx] ? 'line-through text-slate-400' : ''}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Model Answer */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-800 block mb-1">
                    Exemplary Model Answer:
                  </span>
                  <MathText
                    text={block.model_answer}
                    className="text-xs text-slate-700 leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
