import React, { useState, useEffect, useCallback } from 'react';
import type { Guide } from './types.js';
import { fetchGuides, subscribeToGuideUpdates } from './api.js';
import { usePersistence } from './hooks/usePersistence.js';
import { Navbar } from './components/Navbar.js';
import { Dashboard } from './components/Dashboard.js';
import { GuideViewer } from './components/GuideViewer.js';
import { SrsReviewView } from './components/SrsReviewView.js';
import { PinboardView } from './components/PinboardView.js';

export const App: React.FC = () => {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'guide' | 'srs' | 'bookmarks'>('dashboard');
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);

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

  const handleSelectGuide = (guideId: string) => {
    setSelectedGuideId(guideId);
    setCurrentView('guide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToGuideFromPinboard = (guideId: string, blockId: string) => {
    setSelectedGuideId(guideId);
    setCurrentView('guide');
    setTimeout(() => {
      const el = document.getElementById(`block-${blockId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 2000);
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
          setCurrentView(view);
          setSelectedGuideId(null);
        }}
        dueSrsCount={dueSrsCount}
        bookmarkCount={bookmarks.bookmarks.length}
      />

      {loading && !isInitialized ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
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
                setCurrentView('srs');
                setSelectedGuideId(null);
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
                setCurrentView('dashboard');
                setSelectedGuideId(null);
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

          {currentView === 'srs' && (
            <SrsReviewView
              srsData={srs}
              progress={progress}
              onReviewItem={reviewSrsItem}
              onBackToDashboard={() => setCurrentView('dashboard')}
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
