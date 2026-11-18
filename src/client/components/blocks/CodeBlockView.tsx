import React, { useState, useEffect, useMemo } from 'react';
import { Check, Copy, FileCode, Info, Moon, Sun, Edit3, Eye, RotateCcw } from 'lucide-react';
import type { CodeBlock } from '../../types.js';
import { MathText } from '../MathText.js';
import { HighlightedCodeEditor } from '../HighlightedCodeEditor.js';
import { highlightCodeToLines } from '../../utils/syntaxHighlight.js';

interface Props {
  block: CodeBlock;
}

export const CodeBlockView: React.FC<Props> = ({ block }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(block.code);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('study_code_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    setCode(block.code);
    setIsEditing(false);
  }, [block.id, block.code]);

  const isModified = code !== block.code;
  const isLight = theme === 'light';
  const lines = code.split('\n');
  const highlightedLines = useMemo(
    () => highlightCodeToLines(code, block.language),
    [code, block.language]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleTheme = () => {
    const next = isLight ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('study_code_theme', next);
    } catch {}
  };

  const annotationsMap = new Map<number, string>();
  if (block.annotations) {
    for (const ann of block.annotations) {
      annotationsMap.set(ann.line, ann.note);
    }
  }

  const highlightSet = new Set(block.highlight_lines || []);

  return (
    <div
      className={`rounded-xl overflow-hidden border shadow-sm font-mono text-xs sm:text-[13px] leading-6 my-4 transition-colors ${
        isLight
          ? 'border-slate-300 bg-slate-50 text-slate-900'
          : 'border-slate-700 bg-slate-950 text-slate-100'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b ${
          isLight
            ? 'bg-slate-100 border-slate-200 text-slate-600'
            : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}
      >
        <div className="flex items-center space-x-2">
          <FileCode className={`w-4 h-4 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
          <span className={`font-sans font-medium ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
            {block.filename || block.title || `${block.language || 'code'} snippet`}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] uppercase font-semibold ${
              isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {block.language || 'text'}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {isModified && (
            <button
              type="button"
              onClick={() => setCode(block.code)}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                isLight
                  ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Reset to original code"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-sans hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
              isEditing
                ? 'bg-sky-600 text-white'
                : isLight
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isEditing ? 'Switch back to highlighted view' : 'Edit this code snippet'}
          >
            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-sans hidden sm:inline">
              {isEditing ? 'Done' : 'Edit'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleTheme}
            className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
              isLight
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isLight ? 'Switch code block to Dark Theme' : 'Switch code block to High-Contrast Light Theme'}
          >
            {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-sans hidden sm:inline">
              {isLight ? 'Dark' : 'Light'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center space-x-1.5 px-2 py-1 rounded transition-colors ${
              isLight
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Copy code to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-sans">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor or Highlighted View */}
      <div className="p-4 overflow-x-auto">
        {isEditing ? (
          <HighlightedCodeEditor
            value={code}
            onChange={setCode}
            language={block.language}
            theme={theme}
            rows={Math.max(5, Math.min(28, lines.length + 1))}
          />
        ) : (
        <table className={`w-full border-collapse ${isLight ? 'hljs-light' : 'hljs-dark'}`}>
          <tbody>
            {highlightedLines.map((lineHtml, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightSet.has(lineNum);
              const annotation = annotationsMap.get(lineNum);

              return (
                <React.Fragment key={lineNum}>
                  <tr
                    className={
                      isHighlighted
                        ? isLight
                          ? 'bg-sky-100/70 border-l-2 border-sky-600'
                          : 'bg-sky-950/60 border-l-2 border-sky-400'
                        : isLight
                        ? 'hover:bg-slate-100/80'
                        : 'hover:bg-slate-900/70'
                    }
                  >
                    <td
                      className={`w-10 pr-4 text-right select-none text-xs py-0.5 align-top ${
                        isLight ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {lineNum}
                    </td>
                    <td
                      className="pr-4 py-0.5 whitespace-pre"
                      dangerouslySetInnerHTML={{ __html: lineHtml || ' ' }}
                    />
                  </tr>
                  {annotation && (
                    <tr>
                      <td />
                      <td className="pb-2 pt-1 pr-4">
                        <div
                          className={`inline-flex items-start space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-sans leading-snug max-w-2xl whitespace-normal ${
                            isLight
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                              : 'bg-indigo-950/90 border-indigo-700/80 text-indigo-200'
                          }`}
                        >
                          <Info
                            className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                              isLight ? 'text-indigo-600' : 'text-indigo-400'
                            }`}
                          />
                          <MathText text={annotation} as="span" />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
};
