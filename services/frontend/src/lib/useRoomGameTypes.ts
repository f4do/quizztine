/** Deterministic seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit integer. */
export function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return hash;
}

/**
 * Shuffle an array **in place** using Fisher-Yates with a seeded RNG.
 * Returns the same array reference.
 */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── Types ──────────────────────────────────────────────────────────── */

export interface RoomInfo {
  id: string;
  code?: string;
  mode: string;
  timer: number;
  status: string;
  player_count: number;
  total_questions: number;
  players: {
    id: string;
    nickname: string;
    score: number;
    finished: boolean;
    disconnected: boolean;
    answered?: boolean;
  }[];
}

export interface AnswerResult {
  correct: boolean;
  points: number;
  bonus: number;
  streak: number;
  cumulative_time: number;
}

export interface QuestionFeedbackPayload {
  question_id: number;
  correct_choices: number[];
  results: {
    player_id: string;
    nickname: string;
    correct: boolean;
    points: number;
    bonus: number;
    streak: number;
    cumulative_time: number;
  }[];
}

export interface ScoreboardEntry {
  player_id: string;
  nickname: string;
  score: number;
  streak: number;
  cumulative_time: number;
}

export type Phase = "pre-game" | "ready" | "game" | "feedback" | "end";

export interface FeedbackMeta {
  correct: boolean;
  onlyCorrect: boolean;
  firstCorrect: boolean;
  onlyWrong: boolean;
  difficulty: string | null;
  streak?: number;
  totalQuestions?: number;
  /** Player's earned points on this question */
  earnedPoints?: number;
  /** Player's cumulative score */
  score?: number;
  /** Player's running correct count */
  correctCount?: number;
  /** Player's rank (1-based) */
  rank?: number;
  /** Question category name */
  category?: string;
  /** Player pseudo */
  pseudo?: string;
}
