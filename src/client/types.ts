import type { GuideBlock, QuizQuestionBlock, FlashcardBlock } from '../schemas/guide.js';

export * from '../schemas/guide.js';

export interface UserProgressData {
  completed_sections: Record<string, string[]>; // guideId -> array of completed phase names / block IDs
  quiz_history: Record<
    string,
    Record<
      string,
      {
        answered_at: number;
        selected_answer: string | string[];
        is_correct: boolean;
        attempts: number;
      }
    >
  >; // guideId -> questionId -> attempt details
  reflection_notes: Record<string, Record<string, string>>; // guideId -> blockId -> user response text
  last_updated: number;
}

export interface BookmarkItem {
  guide_id: string;
  guide_title: string;
  block_id: string;
  block_type: string;
  title?: string;
  phase: string;
  block: GuideBlock;
  bookmarked_at: number;
}

export interface UserBookmarksData {
  bookmarks: BookmarkItem[];
  last_updated: number;
}

export interface SrsItem {
  id: string; // `${guideId}:${itemId}`
  guide_id: string;
  guide_title: string;
  item_type?: 'quiz' | 'flashcard';
  question_id?: string;
  question?: QuizQuestionBlock;
  card_id?: string;
  flashcard?: FlashcardBlock;
  front?: string;
  back?: string;
  hint?: string;
  state: 'learning' | 'review' | 'relearning';
  due_date: number; // millisecond timestamp
  interval: number; // days
  ease_factor: number; // default 2.5
  repetitions: number;
  last_review?: number;
}

export interface UserSrsData {
  items: SrsItem[];
  last_updated: number;
}

export interface RemediationMissedQuestion {
  question_id: string;
  question: string;
  selected_answer: string | string[];
  correct_answer: string | string[];
  explanation: string;
  difficulty: number;
  related_block_id: string;
}

export interface RemediationReport {
  guide_id: string;
  guide_title: string;
  generated_at: string;
  timestamp: number;
  missed_questions: RemediationMissedQuestion[];
  reflection_notes: Record<string, string>;
  summary: {
    total_questions: number;
    missed_count: number;
    accuracy_percentage: number;
  };
}
