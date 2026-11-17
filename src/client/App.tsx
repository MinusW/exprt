import React, { useState, useEffect, useCallback } from 'react';
import type { Guide } from './types.js';
import { fetchGuides, subscribeToGuideUpdates } from './api.js';
import { usePersistence } from './hooks/usePersistence.js';
import { Navbar } from './components/Navbar.js';
import { Dashboard } from './components/Dashboard.js';
import { GuideViewer } from './components/GuideViewer.js';
import { SrsReviewView } from './components/SrsReviewView.js';
import { PinboardView } from './components/PinboardView.js';

type AppView = 'dashboard' | 'guide' | 'srs' | 'bookmarks';

interface ParsedRoute {
  view: AppView;
  guideId: string | null;
  sectionId: string | null;
}

function parseHashRoute(rawHash: string): ParsedRoute {
  const cleaned = rawHash.replace(/^#\/?/, '');
  if (!cleaned) return { view: 'dashboard', guideId: null, sectionId: null };

  const [pathPart, queryPart] = cleaned.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart || '');
  const sectionId = params.get('section');

  if (segments[0] === 'guide' && segments[1]) {
    return {
      view: 'guide',
      guideId: decodeURIComponent(segments[1]),
      sectionId: sectionId ? decodeURIComponent(sectionId) : null,
    };
  }
  if (segments[0] === 'review' || segments[0] === 'srs') {
    return { view: 'srs', guideId: null, sectionId: null };
  }
  if (segments[0] === 'pinboard' || segments[0] === 'bookmarks') {
    return { view: 'bookmarks', guideId: null, sectionId: null };
  }
  return { view: 'dashboard', guideId: null, sectionId: null };
}

function buildHash(view: AppView, guideId?: string | null, sectionId?: string | null): string {
  if (view === 'guide' && guideId) {
    const base = `#/guide/${encodeURIComponent(guideId)}`;
    return sectionId ? `${base}?section=${encodeURIComponent(sectionId)}` : base;
  }
  if (view === 'srs') return '#/review';
  if (view === 'bookmarks') return '#/pinboard';
  return '#/';
}

export const App: React.FC = () => {
  const initialRoute = parseHashRoute(window.location.hash);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(initialRoute.guideId);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(initialRoute.sectionId);

  const {
    isInitialized,
    progress,
    bookmarks,
    srs,
    togglePhaseComplete,
    resetQuizAnswer,
    resetGuideProgress,
    setGuideAllSectionsComplete,
    recordQuizAnswer,
    saveReflectionNote,
    toggleBookmark,
    removeBookmark,
    reviewSrsItem,
    addOrUpdateFlashcardSrs,
  } = usePersistence();

  // Load guides
  const reloadGuides = useCallback(async () => {
    try {
      const data = await fetchGuides();
      setGuides(data);
    } catch (err) {
      console.error('Error fetching guides:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadGuides();
  }, [reloadGuides]);

  // Live hot-reload via Server-Sent Events (SSE)
  useEffect(() => {
    const unsubscribe = subscribeToGuideUpdates((event) => {
      console.log('⚡ SSE Guide Update received:', event);
      reloadGuides();
    });
    return () => unsubscribe();
  }, [reloadGuides]);

  const selectedGuide = guides.find((g) => g.id === selectedGuideId);

  const navigateTo = useCallback(
    (view: AppView, guideId: string | null = null, sectionId: string | null = null) => {
      const targetHash = buildHash(view, guideId, sectionId);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      setCurrentView(view);
      setSelectedGuideId(guideId);
      setPendingSectionId(sectionId);
    },
    []
  );

  // Sync with browser Back/Forward buttons and manual hash edits
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHashRoute(window.location.hash);
      setCurrentView(parsed.view);
      setSelectedGuideId(parsed.guideId);
      setPendingSectionId(parsed.sectionId);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Scroll to section when opening a shared section deep-link
  useEffect(() => {
    if (currentView === 'guide' && selectedGuide && pendingSectionId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`section-${pendingSectionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
        setPendingSectionId(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentView, selectedGuide, pendingSectionId]);

  // Keep page <title> aligned with current page
  useEffect(() => {
    if (currentView === 'guide' && selectedGuide) {
      document.title = `${selectedGuide.title} · exprt`;
    } else if (currentView === 'srs') {
      document.title = 'Daily Review · exprt';
    } else if (currentView === 'bookmarks') {
      document.title = 'Pinboard · exprt';
    } else {
      document.title = 'exprt';
    }
  }, [currentView, selectedGuide]);

  const handleSelectGuide = (guideId: string) => {
    navigateTo('guide', guideId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToGuideFromPinboard = (guideId: string, blockId: string) => {
    navigateTo('guide', guideId);
    setTimeout(() => {
      const el = document.getElementById(`block-${blockId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-sky-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-sky-500'), 2000);
      }
    }, 200);
  };

  // Due SRS count
  const now = Date.now();
  const dueSrsCount = srs.items.filter((i) => i.due_date <= now).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          navigateTo(view, null);
        }}
        dueSrsCount={dueSrsCount}
        bookmarkCount={bookmarks.bookmarks.length}
      />

      {loading && !isInitialized ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <div className="w-8 h-8 border-3 border-slate-700 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-xs font-medium">Loading Study Guides & User Progress...</span>
        </div>
      ) : (
        <>
          {currentView === 'dashboard' && (
            <Dashboard
              guides={guides}
              progress={progress}
              srsData={srs}
              onSelectGuide={handleSelectGuide}
              onNavigateToSrs={() => {
                navigateTo('srs', null);
              }}
              onToggleGuideComplete={setGuideAllSectionsComplete}
              onResetGuideProgress={resetGuideProgress}
            />
          )}

          {currentView === 'guide' && selectedGuide && (
            <GuideViewer
              guide={selectedGuide}
              progress={progress}
              bookmarks={bookmarks.bookmarks}
              srsData={srs}
              onBack={() => {
                navigateTo('dashboard', null);
              }}
              onMarkPhaseComplete={togglePhaseComplete}
              onResetGuideProgress={resetGuideProgress}
              onSetAllSectionsComplete={setGuideAllSectionsComplete}
              onResetQuizAnswer={resetQuizAnswer}
              onRecordQuizAnswer={recordQuizAnswer}
              onSaveReflectionNote={saveReflectionNote}
              onToggleBookmark={toggleBookmark}
              onRateFlashcard={addOrUpdateFlashcardSrs}
            />
          )}

          {currentView === 'guide' && !selectedGuide && !loading && (
            <div className="max-w-xl mx-auto px-4 py-20 text-center">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Study guide not found</h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-5">
                The shared link points to a guide ID that does not exist.
              </p>
              <button
                onClick={() => navigateTo('dashboard', null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
              >
                Back to Curriculum
              </button>
            </div>
          )}

          {currentView === 'srs' && (
            <SrsReviewView
              srsData={srs}
              progress={progress}
              onReviewItem={reviewSrsItem}
              onBackToDashboard={() => navigateTo('dashboard', null)}
            />
          )}

          {currentView === 'bookmarks' && (
            <PinboardView
              bookmarks={bookmarks.bookmarks}
              onRemoveBookmark={removeBookmark}
              onNavigateToGuide={handleNavigateToGuideFromPinboard}
            />
          )}
        </>
      )}
    </div>
  );
};
