import React, { useState } from 'react';
import { Lightbulb, Copy, Check, Users } from 'lucide-react';
import type { FeynmanPromptBlock } from '../../types.js';
import { MathText } from '../MathText.js';

interface Props {
  block: FeynmanPromptBlock;
  guideTitle: string;
  initialNote?: string;
  onSaveNote: (note: string) => void;
}

export const FeynmanPromptBlockView: React.FC<Props> = ({
  block,
  guideTitle,
  initialNote = '',
  onSaveNote,
}) => {
  const [explanation, setExplanation] = useState(initialNote);
  const [copied, setCopied] = useState(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setExplanation(e.target.value);
    onSaveNote(e.target.value);
  };

  const handleCopyCritiquePrompt = () => {
    const textToCopy = `Please critique my plain-language explanation of the concept "${block.concept}" from the study guide "${guideTitle}".

Target Audience: ${block.target_audience || 'a beginner'}
${block.key_points_to_cover ? `Key Points Expected:\n- ${block.key_points_to_cover.join('\n- ')}\n` : ''}
---
My Explanation:
"${explanation.trim() || '(I need help getting started explaining this concept)'}"
---

Please evaluate:
1. Conceptual Accuracy: Did I introduce any misconceptions, false analogies, or technical inaccuracies?
2. Audience Fit: Is this sufficiently clear, engaging, and jargon-free for ${block.target_audience}?
3. Blind Spots: What critical intuitions or connections did I omit?
4. Polish: How would you sharpen or rephrase this explanation?`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="my-6 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/70 border-b border-amber-100">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-slate-800 text-xs sm:text-sm">
            {block.title || `The Feynman Technique: Explain "${block.concept}"`}
          </span>
        </div>
        <div className="flex items-center space-x-1 text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
          <Users className="w-3 h-3 text-amber-700" />
          <span>Audience: {block.target_audience}</span>
        </div>
      </div>

      <div className="p-4">
        {/* Prompt */}
        <MathText
          text={block.prompt}
          className="text-xs sm:text-sm text-slate-800 leading-relaxed mb-3"
        />

        {/* Key points hints */}
        {block.key_points_to_cover && block.key_points_to_cover.length > 0 && (
          <div className="mb-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600">
            <span className="font-semibold text-slate-700 block mb-1">Key Ideas to Include:</span>
            <ul className="list-disc list-inside space-y-0.5">
              {block.key_points_to_cover.map((point, i) => (
                <li key={i}>
                  <MathText text={point} as="span" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Explanation Textarea */}
        <textarea
          value={explanation}
          onChange={handleTextChange}
          placeholder={`Explain ${block.concept} in your own words, using simple analogies and avoiding unnecessary jargon...`}
          rows={6}
          className="w-full p-3 text-xs sm:text-sm text-slate-800 border border-slate-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none leading-relaxed resize-y bg-slate-50/40"
        />

        {/* Action Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 italic">
            Draft is automatically saved to your local study notes.
          </span>
          <button
            onClick={handleCopyCritiquePrompt}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Critique Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
