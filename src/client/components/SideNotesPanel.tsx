import React, { useState } from 'react';
import {
  StickyNote,
  X,
  Eye,
  Edit3,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { MathText } from './MathText.js';

interface Props {
  guideTitle: string;
  activeSectionId: string;
  activeSectionTitle: string;
  notesMap: Record<string, string>;
  onSaveNote: (noteKey: string, value: string) => void;
  onClose: () => void;
  widthPx?: number;
  onChangeWidthPx?: (width: number) => void;
}

export const GUIDE_NOTES_KEY = '__guide_side_notes__';
export const sectionNoteKey = (sectionId: string) => `__section_side_note_${sectionId}__`;

export const SideNotesPanel: React.FC<Props> = ({
  guideTitle,
  activeSectionId,
  activeSectionTitle,
  notesMap,
  onSaveNote,
  onClose,
  widthPx = 360,
  onChangeWidthPx,
}) => {
  const [scope, setScope] = useState<'guide' | 'section'>('guide');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [copied, setCopied] = useState(false);

  const isWide = widthPx >= 440;
  const activeKey = scope === 'guide' ? GUIDE_NOTES_KEY : sectionNoteKey(activeSectionId);
  const currentText = notesMap[activeKey] || '';

  const guideHasNotes = Boolean((notesMap[GUIDE_NOTES_KEY] || '').trim());
  const sectionHasNotes = Boolean((notesMap[sectionNoteKey(activeSectionId)] || '').trim());

  const handleCopy = () => {
    if (!currentText.trim()) return;
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside
      style={{ '--side-notes-w': `${widthPx}px` } as React.CSSProperties}
      className="w-full lg:w-[var(--side-notes-w)] flex-shrink-0 lg:sticky lg:top-28"
    >
      <div className="bg-white border border-amber-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-8.5rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/80 border-b border-amber-100">
          <div className="flex items-center space-x-2 min-w-0">
            <StickyNote className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
              Study Notes
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {onChangeWidthPx && (
              <button
                type="button"
                onClick={() => onChangeWidthPx(isWide ? 360 : 500)}
                className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-amber-100/60 transition"
                title={isWide ? 'Narrow Notes Panel' : 'Widen Notes Panel'}
              >
                {isWide ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-amber-100/60 transition"
              title="Close Side Notes"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scope Switcher + Edit/Preview Toggle */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50/80 border-b border-slate-100 text-[11px]">
          <div className="flex items-center bg-slate-200/70 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setScope('guide')}
              className={`px-2 py-1 rounded-md font-medium transition flex items-center space-x-1 ${
                scope === 'guide' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`General notes for ${guideTitle}`}
            >
              <span>Guide</span>
              {guideHasNotes && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
            <button
              type="button"
              onClick={() => setScope('section')}
              className={`px-2 py-1 rounded-md font-medium transition flex items-center space-x-1 max-w-[140px] ${
                scope === 'section' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Notes for section: ${activeSectionTitle}`}
            >
              <span className="truncate">Section</span>
              {sectionHasNotes && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
            </button>
          </div>

          <div className="flex items-center bg-slate-200/70 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`px-2 py-1 rounded-md font-medium transition flex items-center space-x-1 ${
                mode === 'edit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`px-2 py-1 rounded-md font-medium transition flex items-center space-x-1 ${
                mode === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {/* Context Label */}
        <div className="px-3.5 py-1.5 bg-white border-b border-slate-100 text-[11px] text-slate-500 truncate">
          {scope === 'guide' ? (
            <span>General notes for this guide</span>
          ) : (
            <span>
              Section: <strong className="text-slate-700 font-medium">{activeSectionTitle}</strong>
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 bg-white min-h-[260px]">
          {mode === 'edit' ? (
            <textarea
              value={currentText}
              onChange={(e) => onSaveNote(activeKey, e.target.value)}
              placeholder={
                scope === 'guide'
                  ? 'Jot down key takeaways, formulas ($E = mc^2$), or ```code``` snippets while studying...'
                  : `Notes for "${activeSectionTitle}"...`
              }
              rows={14}
              className="w-full h-full min-h-[260px] p-2.5 text-xs sm:text-sm text-slate-800 bg-amber-50/20 border border-slate-200 rounded-xl focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-y leading-relaxed font-sans"
            />
          ) : currentText.trim() ? (
            <div className="p-2.5 text-xs sm:text-sm text-slate-800 leading-relaxed">
              <MathText text={currentText} />
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400 italic">
              No notes yet. Switch to Edit to start writing.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Auto-saved locally</span>
          <div className="flex items-center space-x-2">
            {currentText.trim() && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center space-x-1 text-slate-600 hover:text-indigo-700 transition"
                  title="Copy notes to clipboard"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear these notes?')) {
                      onSaveNote(activeKey, '');
                    }
                  }}
                  className="inline-flex items-center space-x-1 text-slate-500 hover:text-rose-600 transition"
                  title="Clear current notes"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
