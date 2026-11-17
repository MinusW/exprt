import React, { useState } from 'react';
import { X, Copy, Check, FileDown, AlertCircle, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import type { RemediationReport } from '../types.js';
import { saveUserData } from '../api.js';
import { MathText } from './MathText.js';

interface Props {
  report: RemediationReport;
  onClose: () => void;
}

export const WeakSpotModal: React.FC<Props> = ({ report, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [savedToServer, setSavedToServer] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const jsonString = JSON.stringify(report, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveToDisk = async () => {
    const ok = await saveUserData('remediation-request', report);
    if (ok) {
      setSavedToServer(true);
      setTimeout(() => setSavedToServer(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden border border-slate-200 transition-all duration-200 ${isMaximized ? 'max-w-5xl h-[92vh]' : 'max-w-2xl max-h-[90vh]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50/60">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Weak-Spot Remediation Package
              </h3>
              <p className="text-slate-500 text-xs">
                Package your missed quiz questions & reflection notes for exprt remediation
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition"
              title={isMaximized ? 'Restore Normal Size' : 'Enlarge Modal'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] text-slate-500 block">Total Questions</span>
              <span className="text-lg font-bold text-slate-900">
                {report.summary.total_questions}
              </span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
              <span className="text-[11px] text-rose-600 block">Missed Questions</span>
              <span className="text-lg font-bold text-rose-700">
                {report.summary.missed_count}
              </span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="text-[11px] text-indigo-600 block">Accuracy</span>
              <span className="text-lg font-bold text-indigo-700">
                {report.summary.accuracy_percentage}%
              </span>
            </div>
          </div>

          {report.missed_questions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-800">
                Missed Concepts Identified:
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {report.missed_questions.map((mq, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-xs text-rose-950"
                  >
                    <MathText text={mq.question} className="font-medium mb-1" />
                    <div className="text-[11px] text-slate-600 mt-1">
                      <span className="font-semibold text-emerald-700">Correct Answer: </span>
                      <MathText
                        text={
                          Array.isArray(mq.correct_answer)
                            ? mq.correct_answer.join(', ')
                            : String(mq.correct_answer)
                        }
                        as="span"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Generated Remediation JSON Payload:
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                user-data/remediation-request.json
              </span>
            </div>
            <pre className="p-3.5 bg-slate-900 text-amber-200 font-mono text-xs rounded-xl overflow-x-auto max-h-60">
              {jsonString}
            </pre>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start space-x-2 text-xs text-blue-900">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Copy this payload or save it to disk. You can then prompt Antigravity:
              <br />
              <em className="font-semibold">
                "Please read user-data/remediation-request.json and generate a targeted remediation mini-guide for my weak spots."
              </em>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleSaveToDisk}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>{savedToServer ? 'Saved to /user-data!' : 'Save to /user-data/remediation-request.json'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
