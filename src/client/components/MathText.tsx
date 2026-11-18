import React, { useMemo } from 'react';
import katex from 'katex';
import { highlightCodeToHtml } from '../utils/syntaxHighlight.js';

interface Props {
  text: string;
  className?: string;
  as?: 'div' | 'span' | 'p';
  blockMath?: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderLatexString(text: string): string {
  if (!text) return '';

  const codeBlocks: { lang: string; code: string }[] = [];
  const mathBlocks: string[] = [];
  const mathInlines: string[] = [];

  // 0. Isolate fenced code blocks ```lang ... ``` BEFORE math/markdown parsing
  //    so indentation, newlines, and `$` symbols inside code are preserved verbatim.
  let preprocessed = text.replace(/```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({
      lang: (lang || '').trim(),
      code: code.replace(/\r?\n$/, ''),
    });
    return `%%%CODE_BLOCK_${idx}%%%`;
  });

  // 1. Isolate block math $$...$$
  preprocessed = preprocessed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const idx = mathBlocks.length;
    mathBlocks.push(math.trim());
    return `%%%MATH_BLOCK_${idx}%%%`;
  });

  // 2. Isolate inline math $...$ (must not be escaped and not empty)
  preprocessed = preprocessed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    const idx = mathInlines.length;
    mathInlines.push(math.trim());
    return `%%%MATH_INLINE_${idx}%%%`;
  });

  // 3. Format basic inline Markdown: code ticks, bold, italics, line breaks
  // Escape HTML tags slightly so user angle brackets don't corrupt markup, but preserve placeholders
  let html = escapeHtml(preprocessed);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  // Italic
  html = html.replace(/\*([^*]+?)\*/g, '<em class="italic">$1</em>');
  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 bg-slate-100 text-indigo-700 rounded font-mono text-[11px] sm:text-xs border border-slate-200">$1</code>'
  );
  // Convert newlines to <br/> (strip redundant <br/> immediately around block code placeholders)
  html = html.replace(/\n*(%%%CODE_BLOCK_\d+%%%)\n*/g, '$1');
  html = html.replace(/\n/g, '<br/>');

  // 4. Substitute rendered KaTeX and fenced code blocks
  html = html.replace(/%%%CODE_BLOCK_(\d+)%%%/g, (_, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const block = codeBlocks[idx];
    if (!block) return '';
    const langHeader = block.lang
      ? `<div class="px-3 py-1 bg-slate-800 border-b border-slate-700 text-[10px] font-mono uppercase tracking-wider text-slate-400 select-none">${escapeHtml(block.lang)}</div>`
      : '';
    return `<div class="my-2.5 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 shadow-sm text-left">${langHeader}<pre class="hljs-dark p-3 overflow-x-auto font-mono text-xs sm:text-[13px] leading-6 whitespace-pre"><code>${highlightCodeToHtml(block.code, block.lang)}</code></pre></div>`;
  });
  html = html.replace(/%%%MATH_BLOCK_(\d+)%%%/g, (_, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const math = mathBlocks[idx] || '';
    try {
      const rendered = katex.renderToString(math, {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="my-3 text-center overflow-x-auto py-1">${rendered}</div>`;
    } catch {
      return `<code>$$${math}$$</code>`;
    }
  });

  html = html.replace(/%%%MATH_INLINE_(\d+)%%%/g, (_, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const math = mathInlines[idx] || '';
    try {
      return katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<code>$${math}$</code>`;
    }
  });

  return html;
}

export const MathText: React.FC<Props> = ({
  text,
  className = '',
  as = 'div',
}) => {
  const renderedHtml = useMemo(() => renderLatexString(text), [text]);

  const Component = as;
  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
