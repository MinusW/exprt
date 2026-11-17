import React, { useRef } from 'react';
import {
  tokenizeCodeLine,
  DARK_TOKEN_CLASSES,
  LIGHT_TOKEN_CLASSES,
} from '../utils/syntaxHighlight.js';

interface Props {
  value: string;
  onChange: (next: string) => void;
  language?: string;
  theme?: 'dark' | 'light';
  rows?: number;
  minHeightClass?: string;
  className?: string;
}

/**
 * Lightweight syntax-highlighted code editor using a synchronized
 * transparent-textarea overlay over tokenized code lines.
 * Supports 4-space Tab indentation.
 */
export const HighlightedCodeEditor: React.FC<Props> = ({
  value,
  onChange,
  language,
  theme = 'dark',
  rows = 10,
  minHeightClass = 'min-h-[160px]',
  className = '',
}) => {
  const preRef = useRef<HTMLPreElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isLight = theme === 'light';
  const tokenClasses = isLight ? LIGHT_TOKEN_CLASSES : DARK_TOKEN_CLASSES;
  const lines = value.split('\n');

  const syncScroll = () => {
    if (!preRef.current || !textareaRef.current) return;
    preRef.current.scrollTop = textareaRef.current.scrollTop;
    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = value.slice(0, start) + '    ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
        syncScroll();
      });
    }
  };

  return (
    <div
      className={`relative rounded-lg border overflow-hidden ${
        isLight
          ? 'bg-white border-slate-300 focus-within:border-sky-500'
          : 'bg-slate-950 border-slate-700 focus-within:border-sky-500'
      } ${minHeightClass} ${className}`}
    >
      {/* Syntax-highlighted backdrop */}
      <pre
        ref={preRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-0 p-3 overflow-hidden font-mono text-xs sm:text-[13px] leading-6 whitespace-pre"
      >
        {lines.map((line, idx) => {
          const tokens = tokenizeCodeLine(line, language);
          return (
            <div key={idx} className="min-h-[1.5rem]">
              {tokens.length === 0
                ? ' '
                : tokens.map((tok, tIdx) => (
                    <span key={tIdx} className={tokenClasses[tok.type]}>
                      {tok.value}
                    </span>
                  ))}
            </div>
          );
        })}
        {value.endsWith('\n') && <div className="min-h-[1.5rem]"> </div>}
      </pre>

      {/* Transparent interactive textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        rows={rows}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={`relative z-10 block w-full h-full m-0 p-3 bg-transparent text-transparent font-mono text-xs sm:text-[13px] leading-6 whitespace-pre overflow-auto outline-none resize-y ${
          isLight
            ? 'caret-slate-900 selection:bg-sky-300/40'
            : 'caret-white selection:bg-sky-500/35'
        }`}
      />
    </div>
  );
};
