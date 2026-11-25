import React, { useMemo } from 'react';
import katex from 'katex';
import { marked } from 'marked';
import { highlightCodeToHtml } from '../utils/syntaxHighlight.js';

interface Props {
  content: string;
  className?: string;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderRichMarkdown(text: string): string {
  if (!text) return '';

  const codeBlocks: Array<{ lang: string; code: string }> = [];
  const mathBlocks: string[] = [];
  const mathInlines: string[] = [];

  // Step 0: Isolate fenced code blocks ```lang ... ``` so `$` inside code isn't treated as LaTeX
  //         and render them with highlight.js
  let preprocessed = text.replace(/```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({
      lang: (lang || '').trim(),
      code: code.replace(/\r?\n$/, ''),
    });
    return `%%%CODE_BLOCK_${idx}%%%`;
  });

  // Step 1: Protect block math $$...$$
  preprocessed = preprocessed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const idx = mathBlocks.length;
    mathBlocks.push(math.trim());
    return `%%%MATH_BLOCK_${idx}%%%`;
  });

  // Step 2: Protect inline math $...$
  preprocessed = preprocessed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    const idx = mathInlines.length;
    mathInlines.push(math.trim());
    return `%%%MATH_INLINE_${idx}%%%`;
  });

  // Step 3: Parse standard GitHub Flavored Markdown (headings, lists, tables, blockquotes, etc.)
  let html = marked.parse(preprocessed) as string;

  // Step 4: Restore fenced code blocks with highlight.js syntax highlighting
  html = html.replace(/%%%CODE_BLOCK_(\d+)%%%/g, (_, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const block = codeBlocks[idx];
    if (!block) return '';
    const langHeader = block.lang
      ? `<div class="px-3 py-1 bg-slate-900 border-b border-slate-700 text-[10px] font-mono uppercase tracking-wider text-slate-400 select-none">${escapeHtml(block.lang)}</div>`
      : '';
    return `<div class="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 shadow-sm text-left">${langHeader}<pre class="hljs-dark p-3.5 overflow-x-auto font-mono text-xs sm:text-[13px] leading-6 whitespace-pre"><code>${highlightCodeToHtml(block.code, block.lang)}</code></pre></div>`;
  });

  // Step 5: Render math placeholders using KaTeX
  html = html.replace(/%%%MATH_BLOCK_(\d+)%%%/g, (_, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const math = mathBlocks[idx] || '';
    try {
      const rendered = katex.renderToString(math, {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="my-4 text-center overflow-x-auto py-1">${rendered}</div>`;
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

export const RichMarkdown: React.FC<Props> = ({ content, className = '' }) => {
  const htmlContent = useMemo(() => renderRichMarkdown(content), [content]);

  return (
    <div className={`prose prose-slate max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed font-sans ${className}`}>
      <div
        className="[&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-slate-900 [&>h1]:mt-5 [&>h1]:mb-3
                   [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-slate-900 [&>h2]:mt-4 [&>h2]:mb-2.5 [&>h2]:border-b [&>h2]:border-slate-200 [&>h2]:pb-1
                   [&>h3]:text-sm [&>h3]:sm:text-base [&>h3]:font-semibold [&>h3]:text-slate-800 [&>h3]:mt-3.5 [&>h3]:mb-1.5
                   [&>h4]:text-xs [&>h4]:sm:text-sm [&>h4]:font-semibold [&>h4]:text-slate-800 [&>h4]:mt-3 [&>h4]:mb-1
                   [&>p]:my-2.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:leading-relaxed
                   [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2.5 [&>ul>li]:my-1
                   [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2.5 [&>ol>li]:my-1
                   [&>blockquote]:border-l-4 [&>blockquote]:border-sky-400 [&>blockquote]:bg-sky-50/50 [&>blockquote]:pl-4 [&>blockquote]:py-2 [&>blockquote]:my-3 [&>blockquote]:rounded-r [&>blockquote]:italic [&>blockquote]:text-slate-700
                   [&>table]:w-full [&>table]:my-3 [&>table]:border-collapse [&>table]:border [&>table]:border-slate-200
                   [&>table_th]:bg-slate-100 [&>table_th]:p-2 [&>table_th]:border [&>table_th]:border-slate-200 [&>table_th]:text-left [&>table_th]:font-semibold
                   [&>table_td]:p-2 [&>table_td]:border [&>table_td]:border-slate-200
                   [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:bg-slate-100 [&_:not(pre)>code]:text-slate-800 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-xs [&_:not(pre)>code]:border [&_:not(pre)>code]:border-slate-200"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};
