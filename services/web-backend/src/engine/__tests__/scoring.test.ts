import { describe, it, expect } from 'vitest'
import { calculateScore, isAnswerCorrect } from '../scoring.js'
import type { ScoringContext } from '../types.js'

const makeCtx = (overrides: Partial<ScoringContext> = {}): ScoringContext => ({
  mode: 'solo',
  playerCount: 1,
  difficulty: 'easy',
  isCorrect: true,
  currentStreak: 0,
  firstCorrect: false,
  aloneCorrect: false,
  ...overrides,
})

describe('calculateScore', () => {
  /* ── Base points ────────────────────────────────────────────────── */

  it('easy difficulty = 10 base points', () => {
    const result = calculateScore(makeCtx({ difficulty: 'easy' }))
    expect(result.total).toBe(10)
    expect(result.bonus).toBe(0)
    expect(result.newStreak).toBe(1)
  })

  it('medium difficulty = 15 base points', () => {
    const result = calculateScore(makeCtx({ difficulty: 'medium' }))
    expect(result.total).toBe(15)
  })

  it('hard difficulty = 20 base points', () => {
    const result = calculateScore(makeCtx({ difficulty: 'hard' }))
    expect(result.total).toBe(20)
  })

  /* ── Solo mode: no bonus ───────────────────────────────────────── */

  it('solo mode: no multi bonus even with firstCorrect/aloneCorrect', () => {
    const result = calculateScore(makeCtx({
      mode: 'solo',
      playerCount: 1,
      firstCorrect: true,
      aloneCorrect: true,
    }))
    expect(result.total).toBe(10) // just base
    expect(result.bonus).toBe(0)
  })

  /* ── Multi 2 players: no bonus ─────────────────────────────────── */

  it('multi 2 players: no bonus', () => {
    const result = calculateScore(makeCtx({
      mode: 'multi_public',
      playerCount: 2,
    }))
    expect(result.total).toBe(10)
    expect(result.bonus).toBe(0)
  })

  /* ── Multi 3+ players: bonuses ─────────────────────────────────── */

  it('multi 3+ players: first correct = +5', () => {
    const result = calculateScore(makeCtx({
      mode: 'multi_public',
      playerCount: 3,
      firstCorrect: true,
      aloneCorrect: false,
    }))
    expect(result.total).toBe(15) // 10 + 5
    expect(result.bonus).toBe(5)
  })

  it('multi 3+ players: alone correct = +3', () => {
    const result = calculateScore(makeCtx({
      mode: 'multi_public',
      playerCount: 3,
      firstCorrect: false,
      aloneCorrect: true,
    }))
    expect(result.total).toBe(13) // 10 + 3
    expect(result.bonus).toBe(3)
  })

  it('multi 3+ players: first + alone stackable = +8', () => {
    const result = calculateScore(makeCtx({
      mode: 'multi_public',
      playerCount: 3,
      firstCorrect: true,
      aloneCorrect: true,
    }))
    expect(result.total).toBe(18) // 10 + 5 + 3
    expect(result.bonus).toBe(8)
  })

  /* ── Solo streak ────────────────────────────────────────────────── */

  it('solo streak: +1 per streak step', () => {
    const result = calculateScore(makeCtx({
      mode: 'solo',
      currentStreak: 3,
    }))
    // base(10) + streak(3) = 13
    expect(result.total).toBe(13)
    expect(result.bonus).toBe(0)
    expect(result.newStreak).toBe(4)
  })

  it('solo streak: caps at +10', () => {
    const result = calculateScore(makeCtx({
      mode: 'solo',
      difficulty: 'medium',
      currentStreak: 10,
    }))
    // base(15) + streak(10) = 25
    expect(result.total).toBe(25)
    expect(result.newStreak).toBe(11)
  })

  it('solo streak 0 yields 0 bonus', () => {
    const result = calculateScore(makeCtx({
      mode: 'solo',
      currentStreak: 0,
    }))
    expect(result.total).toBe(10)
    expect(result.bonus).toBe(0)
  })

  /* ── Wrong answer ───────────────────────────────────────────────── */

  it('wrong answer: 0 points, bonus 0, streak reset to 0', () => {
    const result = calculateScore(makeCtx({
      isCorrect: false,
      currentStreak: 5,
    }))
    expect(result.total).toBe(0)
    expect(result.bonus).toBe(0)
    expect(result.newStreak).toBe(0)
  })

  /* ── Base + streak + multi (edge) ──────────────────────────────── */

  it('hard correct with streak 2 in solo = 20 + 2 = 22', () => {
    const result = calculateScore(makeCtx({
      difficulty: 'hard',
      mode: 'solo',
      currentStreak: 2,
    }))
    expect(result.total).toBe(22)
  })
})

describe('isAnswerCorrect', () => {
  const qType = 'MCQ'

  it('single correct choice', () => {
    expect(isAnswerCorrect([0], [0], qType)).toBe(true)
  })

  it('single wrong choice', () => {
    expect(isAnswerCorrect([0], [1], qType)).toBe(false)
  })

  it('multiple correct choices – all selected', () => {
    expect(isAnswerCorrect([0, 1], [0, 1], qType)).toBe(true)
  })

  it('multiple correct – partial selection is wrong', () => {
    expect(isAnswerCorrect([0, 1], [0], qType)).toBe(false)
    expect(isAnswerCorrect([0, 1], [1], qType)).toBe(false)
  })

  it('extra wrong choice included', () => {
    expect(isAnswerCorrect([0], [0, 1], qType)).toBe(false)
  })

  it('empty correct choices: no selection is correct', () => {
    expect(isAnswerCorrect([], [], qType)).toBe(true)
  })

  it('empty correct choices: any selection is wrong', () => {
    expect(isAnswerCorrect([], [0], qType)).toBe(false)
  })

  it('defaults to MCQ validator when type omitted', () => {
    expect(isAnswerCorrect([0], [0])).toBe(true)
    expect(isAnswerCorrect([0], [1])).toBe(false)
  })
})
