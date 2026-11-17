import React from 'react';
import { Compass, BookMarked, BrainCircuit, Sparkles } from 'lucide-react';

interface Props {
  currentView: 'dashboard' | 'guide' | 'srs' | 'bookmarks';
  onNavigate: (view: 'dashboard' | 'srs' | 'bookmarks') => void;
  dueSrsCount: number;
  bookmarkCount: number;
}

export const Navbar: React.FC<Props> = ({
  currentView,
  onNavigate,
  dueSrsCount,
  bookmarkCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center space-x-2.5 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm group-hover:bg-slate-800 transition">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base font-mono">
              exprt
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              currentView === 'dashboard'
                ? 'bg-slate-100 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Curriculum</span>
          </button>

          <button
            onClick={() => onNavigate('srs')}
            className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              currentView === 'srs'
                ? 'bg-slate-100 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
            <span>Daily Review</span>
            {dueSrsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                {dueSrsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('bookmarks')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              currentView === 'bookmarks'
                ? 'bg-slate-100 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5 text-blue-500" />
            <span>Pinboard</span>
            {bookmarkCount > 0 && (
              <span className="ml-1 text-[11px] text-slate-400 font-mono font-medium">
                ({bookmarkCount})
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
