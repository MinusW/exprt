import React, { useMemo, useRef } from 'react';
import { highlightCodeToHtml } from '../utils/syntaxHighlight.js';

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
 * Live syntax-highlighted code editor using highlight.js grammars and a
 * synchronized transparent-textarea overlay. Supports 4-space Tab indentation.
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
  const highlightedHtml = useMemo(() => {
    const html = highlightCodeToHtml(value, language);
    return value.endsWith('\n') ? `${html} ` : html;
  }, [value, language]);

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
        className={`pointer-events-none absolute inset-0 m-0 p-3 overflow-hidden font-mono text-xs sm:text-[13px] leading-6 whitespace-pre ${
          isLight ? 'hljs-light' : 'hljs-dark'
        }`}
        dangerouslySetInnerHTML={{ __html: highlightedHtml || ' ' }}
      />

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
