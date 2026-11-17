import { useState, useEffect, useCallback } from 'react';
import type { UserProgressData, UserBookmarksData, UserSrsData, BookmarkItem, SrsItem, QuizQuestionBlock, FlashcardBlock } from '../types.js';
import { getUserData, saveUserData } from '../api.js';

const DEFAULT_PROGRESS: UserProgressData = {
  completed_sections: {},
  quiz_history: {},
  reflection_notes: {},
  last_updated: 0,
};

const DEFAULT_BOOKMARKS: UserBookmarksData = {
  bookmarks: [],
  last_updated: 0,
};

const DEFAULT_SRS: UserSrsData = {
  items: [],
  last_updated: 0,
};

export function usePersistence() {
  const [progress, setProgress] = useState<UserProgressData>(() => {
    try {
      const stored = localStorage.getItem('study_progress');
      return stored ? JSON.parse(stored) : DEFAULT_PROGRESS;
    } catch {
      return DEFAULT_PROGRESS;
    }
  });

  const [bookmarks, setBookmarks] = useState<UserBookmarksData>(() => {
    try {
      const stored = localStorage.getItem('study_bookmarks');
      return stored ? JSON.parse(stored) : DEFAULT_BOOKMARKS;
    } catch {
      return DEFAULT_BOOKMARKS;
    }
  });

  const [srs, setSrs] = useState<UserSrsData>(() => {
    try {
      const stored = localStorage.getItem('study_srs');
      return stored ? JSON.parse(stored) : DEFAULT_SRS;
    } catch {
      return DEFAULT_SRS;
    }
  });

  const [isInitialized, setIsInitialized] = useState(false);

  // Startup reconciliation between localStorage and backend /user-data/
  useEffect(() => {
    async function reconcileData() {
      try {
        const [remoteProgress, remoteBookmarks, remoteSrs] = await Promise.all([
          getUserData<UserProgressData>('progress'),
          getUserData<UserBookmarksData>('bookmarks'),
          getUserData<UserSrsData>('srs-queue'),
        ]);

        // Reconcile Progress
        const localProgRaw = localStorage.getItem('study_progress');
        const localProg: UserProgressData | null = localProgRaw ? JSON.parse(localProgRaw) : null;
        if (remoteProgress && (!localProg || remoteProgress.last_updated >= localProg.last_updated)) {
          setProgress(remoteProgress);
          localStorage.setItem('study_progress', JSON.stringify(remoteProgress));
        } else if (localProg && (!remoteProgress || localProg.last_updated > remoteProgress.last_updated)) {
          setProgress(localProg);
          saveUserData('progress', localProg);
        }

        // Reconcile Bookmarks
        const localBmRaw = localStorage.getItem('study_bookmarks');
        const localBm: UserBookmarksData | null = localBmRaw ? JSON.parse(localBmRaw) : null;
        if (remoteBookmarks && (!localBm || remoteBookmarks.last_updated >= localBm.last_updated)) {
          setBookmarks(remoteBookmarks);
          localStorage.setItem('study_bookmarks', JSON.stringify(remoteBookmarks));
        } else if (localBm && (!remoteBookmarks || localBm.last_updated > remoteBookmarks.last_updated)) {
          setBookmarks(localBm);
          saveUserData('bookmarks', localBm);
        }

        // Reconcile SRS
        const localSrsRaw = localStorage.getItem('study_srs');
        const localSrs: UserSrsData | null = localSrsRaw ? JSON.parse(localSrsRaw) : null;
        if (remoteSrs && (!localSrs || remoteSrs.last_updated >= localSrs.last_updated)) {
          setSrs(remoteSrs);
          localStorage.setItem('study_srs', JSON.stringify(remoteSrs));
        } else if (localSrs && (!remoteSrs || localSrs.last_updated > remoteSrs.last_updated)) {
          setSrs(localSrs);
          saveUserData('srs-queue', localSrs);
        }
      } catch (err) {
        console.error('Reconciliation error on startup:', err);
      } finally {
        setIsInitialized(true);
      }
    }

    reconcileData();
  }, []);

  // Update Progress Helper
  const updateProgress = useCallback((updater: (prev: UserProgressData) => UserProgressData) => {
    setProgress((prev) => {
      const updated = updater(prev);
      const withTimestamp: UserProgressData = {
        ...updated,
        last_updated: Date.now(),
      };
      localStorage.setItem('study_progress', JSON.stringify(withTimestamp));
      saveUserData('progress', withTimestamp);
      return withTimestamp;
    });
  }, []);

  // Toggle or set section / phase completion (bidirectional: can check AND uncheck)
  const togglePhaseComplete = useCallback(
    (guideId: string, phaseName: string, forceState?: boolean) => {
      updateProgress((prev) => {
        const current = prev.completed_sections[guideId] || [];
        const isCurrentlyCompleted = current.includes(phaseName);
        const shouldBeCompleted = forceState !== undefined ? forceState : !isCurrentlyCompleted;

        let updated: string[];
        if (shouldBeCompleted) {
          updated = isCurrentlyCompleted ? current : [...current, phaseName];
        } else {
          updated = current.filter((p) => p !== phaseName);
        }

        return {
          ...prev,
          completed_sections: {
            ...prev.completed_sections,
            [guideId]: updated,
          },
        };
      });
    },
    [updateProgress]
  );

  // Backward compatible alias for togglePhaseComplete
  const markPhaseComplete = togglePhaseComplete;

  // Reset or clear a recorded quiz answer for a question (allowing re-attempt from scratch)
  const resetQuizAnswer = useCallback(
    (guideId: string, questionId: string) => {
      updateProgress((prev) => {
        const guideQuiz = { ...(prev.quiz_history[guideId] || {}) };
        delete guideQuiz[questionId];
        return {
          ...prev,
          quiz_history: {
            ...prev.quiz_history,
            [guideId]: guideQuiz,
          },
        };
      });
    },
    [updateProgress]
  );

  // Reset all user progress for a specific guide (unchecks all sections, clears quiz attempts & notes)
  const resetGuideProgress = useCallback(
    (guideId: string) => {
      updateProgress((prev) => {
        const nextCompleted = { ...prev.completed_sections };
        delete nextCompleted[guideId];

        const nextQuiz = { ...prev.quiz_history };
        delete nextQuiz[guideId];

        const nextNotes = { ...prev.reflection_notes };
        delete nextNotes[guideId];

        return {
          ...prev,
          completed_sections: nextCompleted,
          quiz_history: nextQuiz,
          reflection_notes: nextNotes,
        };
      });
    },
    [updateProgress]
  );

  // Mark all or none of a guide's sections as complete
  const setGuideAllSectionsComplete = useCallback(
    (guideId: string, allSectionIds: string[], completed: boolean) => {
      updateProgress((prev) => ({
        ...prev,
        completed_sections: {
          ...prev.completed_sections,
          [guideId]: completed ? [...allSectionIds] : [],
        },
      }));
    },
    [updateProgress]
  );

  // Record Quiz Result
  const recordQuizAnswer = useCallback(
    (
      guideId: string,
      questionId: string,
      selectedAnswer: string | string[],
      isCorrect: boolean,
      questionBlock?: QuizQuestionBlock,
      guideTitle?: string
    ) => {
      updateProgress((prev) => {
        const guideQuiz = prev.quiz_history[guideId] || {};
        const prevAttempt = guideQuiz[questionId];
        const attempts = (prevAttempt?.attempts || 0) + 1;

        return {
          ...prev,
          quiz_history: {
            ...prev.quiz_history,
            [guideId]: {
              ...guideQuiz,
              [questionId]: {
                answered_at: Date.now(),
                selected_answer: selectedAnswer,
                is_correct: isCorrect,
                attempts,
              },
            },
          },
        };
      });

      // Also register or update SRS review queue item
      if (questionBlock && guideTitle) {
        setSrs((prev) => {
          const itemId = `${guideId}:${questionId}`;
          const existingIndex = prev.items.findIndex((i) => i.id === itemId);
          let newItems = [...prev.items];

          if (existingIndex >= 0) {
            const current = newItems[existingIndex];
            // FSRS / SM2 algorithm update
            const ease = isCorrect ? Math.min(2.8, current.ease_factor + 0.1) : Math.max(1.3, current.ease_factor - 0.2);
            const interval = isCorrect ? (current.interval === 0 ? 1 : Math.round(current.interval * ease)) : 1;
            const dueDate = Date.now() + interval * 24 * 60 * 60 * 1000;

            newItems[existingIndex] = {
              ...current,
              state: isCorrect ? 'review' : 'relearning',
              due_date: dueDate,
              interval,
              ease_factor: ease,
              repetitions: isCorrect ? current.repetitions + 1 : 0,
              last_review: Date.now(),
            };
          } else {
            // First time answering: schedule next review
            const interval = isCorrect ? 1 : 0.5;
            const dueDate = Date.now() + interval * 24 * 60 * 60 * 1000;
            newItems.push({
              id: itemId,
              guide_id: guideId,
              guide_title: guideTitle,
              item_type: 'quiz',
              question_id: questionId,
              question: questionBlock,
              front: questionBlock.question,
              back: Array.isArray(questionBlock.correct_answer)
                ? questionBlock.correct_answer.join(', ')
                : String(questionBlock.correct_answer),
              state: isCorrect ? 'review' : 'learning',
              due_date: dueDate,
              interval: isCorrect ? 1 : 0,
              ease_factor: 2.5,
              repetitions: isCorrect ? 1 : 0,
              last_review: Date.now(),
            });
          }

          const withTimestamp: UserSrsData = {
            items: newItems,
            last_updated: Date.now(),
          };
          localStorage.setItem('study_srs', JSON.stringify(withTimestamp));
          saveUserData('srs-queue', withTimestamp);
          return withTimestamp;
        });
      }
    },
    [updateProgress]
  );

  // Save Reflection Note
  const saveReflectionNote = useCallback(
    (guideId: string, blockId: string, noteText: string) => {
      updateProgress((prev) => {
        const guideNotes = prev.reflection_notes[guideId] || {};
        return {
          ...prev,
          reflection_notes: {
            ...prev.reflection_notes,
            [guideId]: {
              ...guideNotes,
              [blockId]: noteText,
            },
          },
        };
      });
    },
    [updateProgress]
  );

  // Add or rate a Flashcard directly in the SRS queue
  const addOrUpdateFlashcardSrs = useCallback(
    (guideId: string, guideTitle: string, flashcard: FlashcardBlock, rating?: 1 | 2 | 3 | 4) => {
      setSrs((prev) => {
        const itemId = `${guideId}:${flashcard.id}`;
        const existingIndex = prev.items.findIndex((i) => i.id === itemId);
        let newItems = [...prev.items];
        const now = Date.now();

        if (existingIndex >= 0) {
          const current = newItems[existingIndex];
          const r = rating || 3;
          let newInterval = current.interval;
          let newEase = current.ease_factor;
          let newRepetitions = current.repetitions;
          let newState = current.state;

          if (r === 1) {
            newInterval = 1;
            newEase = Math.max(1.3, newEase - 0.2);
            newRepetitions = 0;
            newState = 'relearning';
          } else if (r === 2) {
            newInterval = Math.max(1, Math.round(newInterval * 1.2));
            newEase = Math.max(1.3, newEase - 0.15);
            newRepetitions += 1;
            newState = 'review';
          } else if (r === 3) {
            newInterval = Math.max(1, Math.round((newInterval || 1) * newEase));
            newRepetitions += 1;
            newState = 'review';
          } else {
            newInterval = Math.max(2, Math.round((newInterval || 1) * newEase * 1.3));
            newEase = Math.min(3.0, newEase + 0.15);
            newRepetitions += 1;
            newState = 'review';
          }

          const dueDate = now + newInterval * 24 * 60 * 60 * 1000;
          newItems[existingIndex] = {
            ...current,
            flashcard,
            front: flashcard.front,
            back: flashcard.back,
            hint: flashcard.hint,
            state: newState,
            due_date: dueDate,
            interval: newInterval,
            ease_factor: newEase,
            repetitions: newRepetitions,
            last_review: now,
          };
        } else {
          const r = rating || 3;
          const interval = r === 1 ? 0.5 : (r === 4 ? 2 : 1);
          const dueDate = now + interval * 24 * 60 * 60 * 1000;
          newItems.push({
            id: itemId,
            guide_id: guideId,
            guide_title: guideTitle,
            item_type: 'flashcard',
            card_id: flashcard.id,
            flashcard,
            front: flashcard.front,
            back: flashcard.back,
            hint: flashcard.hint,
            state: 'learning',
            due_date: dueDate,
            interval: 1,
            ease_factor: 2.5,
            repetitions: 1,
            last_review: now,
          });
        }

        const withTimestamp: UserSrsData = {
          items: newItems,
          last_updated: now,
        };
        localStorage.setItem('study_srs', JSON.stringify(withTimestamp));
        saveUserData('srs-queue', withTimestamp);
        return withTimestamp;
      });
    },
    []
  );

  // Toggle Bookmark
  const toggleBookmark = useCallback(
    (item: Omit<BookmarkItem, 'bookmarked_at'>) => {
      setBookmarks((prev) => {
        const exists = prev.bookmarks.some(
          (b) => b.guide_id === item.guide_id && b.block_id === item.block_id
        );
        let updatedList: BookmarkItem[];
        if (exists) {
          updatedList = prev.bookmarks.filter(
            (b) => !(b.guide_id === item.guide_id && b.block_id === item.block_id)
          );
        } else {
          updatedList = [
            ...prev.bookmarks,
            {
              ...item,
              bookmarked_at: Date.now(),
            },
          ];
        }

        const withTimestamp: UserBookmarksData = {
          bookmarks: updatedList,
          last_updated: Date.now(),
        };
        localStorage.setItem('study_bookmarks', JSON.stringify(withTimestamp));
        saveUserData('bookmarks', withTimestamp);
        return withTimestamp;
      });
    },
    []
  );

  // Remove specific bookmark cleanly
  const removeBookmark = useCallback((guideId: string, blockId: string) => {
    setBookmarks((prev) => {
      const updatedList = prev.bookmarks.filter(
        (b) => !(b.guide_id === guideId && b.block_id === blockId)
      );
      const withTimestamp: UserBookmarksData = {
        bookmarks: updatedList,
        last_updated: Date.now(),
      };
      localStorage.setItem('study_bookmarks', JSON.stringify(withTimestamp));
      saveUserData('bookmarks', withTimestamp);
      return withTimestamp;
    });
  }, []);

  // Review SRS item rating (1: Again, 2: Hard, 3: Good, 4: Easy)
  const reviewSrsItem = useCallback((itemId: string, rating: 1 | 2 | 3 | 4) => {
    setSrs((prev) => {
      const index = prev.items.findIndex((i) => i.id === itemId);
      if (index === -1) return prev;

      const item = prev.items[index];
      let newInterval = item.interval;
      let newEase = item.ease_factor;
      let newRepetitions = item.repetitions;
      let newState = item.state;

      if (rating === 1) {
        // Again
        newInterval = 1;
        newEase = Math.max(1.3, newEase - 0.2);
        newRepetitions = 0;
        newState = 'relearning';
      } else if (rating === 2) {
        // Hard
        newInterval = Math.max(1, Math.round(newInterval * 1.2));
        newEase = Math.max(1.3, newEase - 0.15);
        newRepetitions += 1;
        newState = 'review';
      } else if (rating === 3) {
        // Good
        newInterval = Math.max(1, Math.round((newInterval || 1) * newEase));
        newRepetitions += 1;
        newState = 'review';
      } else {
        // Easy
        newInterval = Math.max(2, Math.round((newInterval || 1) * newEase * 1.3));
        newEase = Math.min(3.0, newEase + 0.15);
        newRepetitions += 1;
        newState = 'review';
      }

      const dueDate = Date.now() + newInterval * 24 * 60 * 60 * 1000;
      const updatedItem: SrsItem = {
        ...item,
        state: newState,
        due_date: dueDate,
        interval: newInterval,
        ease_factor: newEase,
        repetitions: newRepetitions,
        last_review: Date.now(),
      };

      const newItems = [...prev.items];
      newItems[index] = updatedItem;

      const withTimestamp: UserSrsData = {
        items: newItems,
        last_updated: Date.now(),
      };
      localStorage.setItem('study_srs', JSON.stringify(withTimestamp));
      saveUserData('srs-queue', withTimestamp);
      return withTimestamp;
    });
  }, []);

  return {
    isInitialized,
    progress,
    bookmarks,
    srs,
    markPhaseComplete,
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
  };
}
