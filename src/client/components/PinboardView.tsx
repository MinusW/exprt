import React, { useState } from 'react';
import { BookMarked, Trash2, ArrowUpRight, Search, Download, Printer } from 'lucide-react';
import type { BookmarkItem } from '../types.js';
import { MarkdownBlockView } from './blocks/MarkdownBlockView.js';
import { CodeBlockView } from './blocks/CodeBlockView.js';
import { KrokiBlockView } from './blocks/KrokiBlockView.js';
import { MediaBlockView } from './blocks/MediaBlockView.js';
import { SimulationBlockView } from './blocks/SimulationBlockView.js';
import { FlashcardBlockView } from './blocks/FlashcardBlockView.js';

interface Props {
  bookmarks: BookmarkItem[];
  onRemoveBookmark: (guideId: string, blockId: string) => void;
  onNavigateToGuide: (guideId: string, blockId: string) => void;
}

export const PinboardView: React.FC<Props> = ({
  bookmarks,
  onRemoveBookmark,
  onNavigateToGuide,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = bookmarks.filter((item) => {
    const matchesType = filterType === 'all' || item.block_type === filterType;
    const matchesSearch =
      searchQuery === '' ||
      item.guide_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.block_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExportMarkdown = () => {
    if (bookmarks.length === 0) return;
    const lines = [
      `# exprt Cheatsheet`,
      `*Generated on ${new Date().toLocaleDateString()}*\n`,
      ...bookmarks.map((b) => {
        let blockText = '';
        if (b.block.block_type === 'markdown') blockText = b.block.content;
        else if (b.block.block_type === 'code')
          blockText = `\`\`\`${b.block.language || 'text'}\n${b.block.code}\n\`\`\``;
        else if (b.block.block_type === 'kroki')
          blockText = `\`\`\`${b.block.diagram_type}\n${b.block.source}\n\`\`\``;
        else if (b.block.block_type === 'simulation')
          blockText = `**Formula:** ${b.block.formula || ''}\n*${b.block.description}*`;
        else if (b.block.block_type === 'flashcard')
          blockText = `**Prompt:** ${b.block.front}\n\n**Answer:** ${b.block.back}`;

        return `## ${b.guide_title}: ${b.title || b.block_id}\n*Phase: ${b.phase}*\n\n${blockText}\n\n---\n`;
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study_cheatsheet_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookMarked className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Quick Reference Pinboard
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            All your pinned key formulas, architectural diagrams, cheat sheets, and models in one place.
          </p>
        </div>

        {bookmarks.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
              title="Print Cheatsheet"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={handleExportMarkdown}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
              title="Export as Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Cheatsheet (.md)</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search pinned blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
          {['all', 'kroki', 'code', 'simulation', 'markdown', 'media'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition capitalize ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <BookMarked className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">No Pinned Blocks Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Pin building blocks in any study guide using the bookmark icon to create your personalized quick-reference cheatsheet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((item) => (
            <div
              key={`${item.guide_id}:${item.block_id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative group"
            >
              {/* Card Meta Bar */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">
                    {item.guide_title}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-[11px] uppercase tracking-wider font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-semibold">
                    {item.block_type}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">&bull;</span>
                  <span className="text-slate-500 capitalize hidden sm:inline">
                    {item.phase} Phase
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onNavigateToGuide(item.guide_id, item.block_id)}
                    className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition"
                  >
                    <span>Jump to Guide</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onRemoveBookmark(item.guide_id, item.block_id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition"
                    title="Remove from pinboard"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Render pinned block */}
              {item.block.block_type === 'markdown' && <MarkdownBlockView block={item.block} />}
              {item.block.block_type === 'code' && <CodeBlockView block={item.block} />}
              {item.block.block_type === 'kroki' && <KrokiBlockView block={item.block} />}
              {item.block.block_type === 'media' && <MediaBlockView block={item.block} />}
              {item.block.block_type === 'simulation' && <SimulationBlockView block={item.block} />}
              {item.block.block_type === 'flashcard' && <FlashcardBlockView block={item.block} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
