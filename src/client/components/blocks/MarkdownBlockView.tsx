import React, { useMemo } from 'react';
import katex from 'katex';
import { marked } from 'marked';
import type { MarkdownBlock } from '../../types.js';

interface Props {
  block: MarkdownBlock;
}

// Config marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

function renderLatexAndMarkdown(text: string): string {
  const codeBlocks: string[] = [];
  const mathBlocks: string[] = [];
  const mathInlines: string[] = [];

  // Step 0: Protect fenced code blocks ```...``` so `$` inside code isn't treated as LaTeX
  let preprocessed = text.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
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

  // Restore fenced code blocks before marked.parse() so marked renders <pre><code> properly
  preprocessed = preprocessed.replace(/%%%CODE_BLOCK_(\d+)%%%/g, (_, idxStr) => {
    return codeBlocks[parseInt(idxStr, 10)] || '';
  });

  // Step 3: Parse standard GitHub Flavored Markdown (tables, blockquotes, lists, etc.)
  let html = marked.parse(preprocessed) as string;

  // Step 4: Render math placeholders using KaTeX
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

export const MarkdownBlockView: React.FC<Props> = ({ block }) => {
  const htmlContent = useMemo(() => renderLatexAndMarkdown(block.content), [block.content]);

  return (
    <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
      <div
        className="[&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-slate-900 [&>h1]:mt-6 [&>h1]:mb-4
                   [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-slate-900 [&>h2]:mt-5 [&>h2]:mb-3 [&>h2]:border-b [&>h2]:border-slate-200 [&>h2]:pb-1
                   [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-slate-800 [&>h3]:mt-4 [&>h3]:mb-2
                   [&>p]:my-3 [&>p]:leading-relaxed
                   [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-3 [&>ul>li]:my-1
                   [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-3 [&>ol>li]:my-1
                   [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-400 [&>blockquote]:bg-indigo-50/40 [&>blockquote]:pl-4 [&>blockquote]:py-2 [&>blockquote]:my-3 [&>blockquote]:rounded-r [&>blockquote]:italic [&>blockquote]:text-slate-700
                   [&>table]:w-full [&>table]:my-4 [&>table]:border-collapse [&>table]:border [&>table]:border-slate-200
                   [&>table_th]:bg-slate-100 [&>table_th]:p-2.5 [&>table_th]:border [&>table_th]:border-slate-200 [&>table_th]:text-left [&>table_th]:font-semibold
                   [&>table_td]:p-2 [&>table_td]:border [&>table_td]:border-slate-200
                   [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-slate-100 [&_code]:text-indigo-700 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_code]:border [&_code]:border-slate-200
                   [&>pre]:my-3 [&>pre]:p-3.5 [&>pre]:rounded-xl [&>pre]:bg-slate-900 [&>pre]:text-slate-100 [&>pre]:overflow-x-auto [&>pre]:border [&>pre]:border-slate-700 [&>pre]:shadow-sm
                   [&>pre_code]:bg-transparent [&>pre_code]:text-slate-100 [&>pre_code]:border-0 [&>pre_code]:p-0 [&>pre_code]:text-xs [&>pre_code]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};
