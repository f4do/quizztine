/* ------------------------------------------------------------------ */
/*  Scoring engine                                                     */
/*  Port of scoring.py                                                 */
/* ------------------------------------------------------------------ */

import type { ScoringContext, ScoreResult, Difficulty } from './types.js'
import { validateAnswer } from './answer-validator.js'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BASE_POINTS: Record<Difficulty, number> = {
  easy: 10,
  medium: 15,
  hard: 20,
}

const STREAK_BONUS_PER_STEP = 1
const MAX_STREAK_BONUS = 10

/* ------------------------------------------------------------------ */
/*  Bonus calculators (plain functions — no Protocol classes needed)   */
/* ------------------------------------------------------------------ */

function multiBonus(ctx: ScoringContext): number {
  if (ctx.playerCount < 3) return 0
  let bonus = 0
  if (ctx.firstCorrect) bonus += 5
  if (ctx.aloneCorrect) bonus += 3
  return bonus
}

function streakBonus(ctx: ScoringContext): number {
  if (!ctx.isCorrect) return 0
  const bonus = ctx.currentStreak * STREAK_BONUS_PER_STEP
  return Math.min(bonus, MAX_STREAK_BONUS)
}

/* ------------------------------------------------------------------ */
/*  Calculator                                                         */
/* ------------------------------------------------------------------ */

export function calculateScore(ctx: ScoringContext): ScoreResult {
  if (!ctx.isCorrect) {
    return { total: 0, bonus: 0, newStreak: 0 }
  }

  const base = BASE_POINTS[ctx.difficulty] ?? 15
  const bonus = multiBonus(ctx)
  const streak = ctx.mode === 'solo' ? streakBonus(ctx) : 0
  const newStreak = ctx.currentStreak + 1

  return { total: base + bonus + streak, bonus, newStreak }
}

/* ------------------------------------------------------------------ */
/*  Helper: check answer correctness (delegates to answer validators)  */
/* ------------------------------------------------------------------ */

export function isAnswerCorrect(
  correctChoices: number[],
  selectedChoices: number[],
  questionType = 'MCQ',
): boolean {
  return validateAnswer(questionType, correctChoices, selectedChoices)
}
