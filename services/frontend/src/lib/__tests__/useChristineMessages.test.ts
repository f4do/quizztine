import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChristineMessages } from '../useChristineMessages'
import type { FeedbackMeta, ScoreboardEntry } from '../useRoomGameTypes'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      switch (key) {
        case 'christine.pre.solo':
          return 'Ready for solo training?'
        case 'christine.pre.welcome':
          return 'Welcome to the quiz!'
        case 'christine.question.default':
          return `Question ${params?.index}`
        case 'christine.question.easy':
          return `Easy Q${params?.index}`
        case 'christine.question.hard':
          return `Hard Q${params?.index}`
        case 'christine.feedback.timeout':
          return 'Time expired!'
        case 'christine.feedback.correct':
          return 'Correct answer!'
        case 'christine.feedback.correct_hard':
          return 'Correct hard!'
        case 'christine.feedback.first_correct':
          return 'First correct!'
        case 'christine.feedback.only_correct':
          return 'Only correct!'
        case 'christine.feedback.wrong':
          return 'Wrong answer!'
        case 'christine.feedback.only_wrong':
          return 'Only wrong!'
        case 'christine.end.winner':
          return `Winner ${params?.score}`
        case 'christine.end.low':
          return 'Low score'
        case 'christine.end.default':
          return params?.score != null ? `End ${params?.score}` : 'End'
        case 'room.easter_egg':
          return 'Easter egg!'
        default:
          return key
      }
    },
  }),
}))

function feedbackMeta(overrides: Partial<FeedbackMeta> = {}): FeedbackMeta {
  return {
    correct: false,
    onlyCorrect: false,
    firstCorrect: false,
    onlyWrong: false,
    difficulty: null,
    ...overrides,
  }
}

function scoreboardEntry(
  playerId: string,
  overrides: Partial<ScoreboardEntry> = {},
): ScoreboardEntry {
  return {
    player_id: playerId,
    nickname: playerId,
    score: 0,
    streak: 0,
    cumulative_time: 0,
    ...overrides,
  }
}

const defaults = {
  phase: 'pre-game' as const,
  roomMode: undefined,
  questionIndex: 0,
  questionDifficulty: null,
  feedbackMeta: feedbackMeta(),
  timerExpired: false,
  scoreboard: [] as ScoreboardEntry[],
  playerId: 'p1',
}

describe('useChristineMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ── pre-game ─────────────────────────────────────────────────── */

  it('returns solo message when roomMode is solo', () => {
    const { result } = renderHook(() =>
      useChristineMessages({ ...defaults, phase: 'pre-game', roomMode: 'solo' }),
    )
    expect(result.current.christineMessage).toBe('Ready for solo training?')
    expect(result.current.christineExpression).toBe('smile')
  })

  it('returns welcome message when roomMode is not solo', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'pre-game',
        roomMode: 'multi_public',
      }),
    )
    expect(result.current.christineMessage).toBe('Welcome to the quiz!')
    expect(result.current.christineExpression).toBe('smile')
  })

  /* ── game ─────────────────────────────────────────────────────── */

  it('returns focused expression and default question message', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'game',
        questionDifficulty: null,
        questionIndex: 4,
      }),
    )
    expect(result.current.christineMessage).toBe('Question 5')
    expect(result.current.christineExpression).toBe('focused')
  })

  it('returns focused expression and easy question message', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'game',
        questionDifficulty: 'EASY',
        questionIndex: 1,
      }),
    )
    expect(result.current.christineMessage).toBe('Easy Q2')
    expect(result.current.christineExpression).toBe('focused')
  })

  it('returns focused expression and hard question message', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'game',
        questionDifficulty: 'HARD',
        questionIndex: 9,
      }),
    )
    expect(result.current.christineMessage).toBe('Hard Q10')
    expect(result.current.christineExpression).toBe('focused')
  })

  /* ── feedback ─────────────────────────────────────────────────── */

  it('returns timeout message with console expression when timer expired', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        timerExpired: true,
        feedbackMeta: feedbackMeta({ correct: false }),
      }),
    )
    expect(result.current.christineMessage).toBe('Time expired!')
    expect(result.current.christineExpression).toBe('console')
  })

  it('returns correct message with applause expression', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        feedbackMeta: feedbackMeta({ correct: true }),
      }),
    )
    expect(result.current.christineMessage).toBe('Correct answer!')
    expect(result.current.christineExpression).toBe('applause')
  })

  it('returns only_correct message when onlyCorrect is true', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        feedbackMeta: feedbackMeta({ correct: true, onlyCorrect: true }),
      }),
    )
    expect(result.current.christineMessage).toBe('Only correct!')
    expect(result.current.christineExpression).toBe('applause')
  })

  it('returns first_correct message when firstCorrect is true', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        feedbackMeta: feedbackMeta({
          correct: true,
          onlyCorrect: false,
          firstCorrect: true,
        }),
      }),
    )
    expect(result.current.christineMessage).toBe('First correct!')
    expect(result.current.christineExpression).toBe('applause')
  })

  it('returns correct_hard message when difficulty is HARD and correct', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        feedbackMeta: feedbackMeta({
          correct: true,
          onlyCorrect: false,
          firstCorrect: false,
          difficulty: 'HARD',
        }),
      }),
    )
    expect(result.current.christineMessage).toBe('Correct hard!')
    expect(result.current.christineExpression).toBe('applause')
  })

  it('returns wrong message with console expression', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        feedbackMeta: feedbackMeta({ correct: false }),
      }),
    )
    expect(result.current.christineMessage).toBe('Wrong answer!')
    expect(result.current.christineExpression).toBe('console')
  })

  it('returns only_wrong message when onlyWrong is true', () => {
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'feedback',
        feedbackMeta: feedbackMeta({ correct: false, onlyWrong: true }),
      }),
    )
    expect(result.current.christineMessage).toBe('Only wrong!')
    expect(result.current.christineExpression).toBe('console')
  })

  /* ── end ──────────────────────────────────────────────────────── */

  it('returns winner message with applause when player is first', () => {
    const sb = [
      scoreboardEntry('p1', { score: 120 }),
      scoreboardEntry('p2', { score: 80 }),
    ]
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'end',
        scoreboard: sb,
        playerId: 'p1',
      }),
    )
    expect(result.current.christineMessage).toBe('Winner 120')
    expect(result.current.christineExpression).toBe('applause')
  })

  it('returns easter egg when all scores are zero in multiplayer', () => {
    const sb = [
      scoreboardEntry('p1', { score: 0 }),
      scoreboardEntry('p2', { score: 0 }),
    ]
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'end',
        roomMode: 'multi_public',
        scoreboard: sb,
        playerId: 'p1',
      }),
    )
    expect(result.current.christineMessage).toBe('Easter egg!')
    // easter egg path: own found and player is first → applause
    expect(result.current.christineExpression).toBe('applause')
  })

  it('does NOT show easter egg in solo mode even when all scores zero', () => {
    const sb = [scoreboardEntry('p1', { score: 0 })]
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'end',
        roomMode: 'solo',
        scoreboard: sb,
        playerId: 'p1',
      }),
    )
    // roomMode === 'solo' skips the easter-egg check, falls through to winner check
    expect(result.current.christineMessage).toBe('Winner 0')
    expect(result.current.christineExpression).toBe('applause')
  })

  it('returns low message with console when score is 0', () => {
    const sb = [
      scoreboardEntry('p2', { score: 50 }),
      scoreboardEntry('p1', { score: 0 }),
    ]
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'end',
        roomMode: 'solo',
        scoreboard: sb,
        playerId: 'p1',
      }),
    )
    expect(result.current.christineMessage).toBe('Low score')
    expect(result.current.christineExpression).toBe('console')
  })

  it('returns default end message with smile when not winner', () => {
    const sb = [
      scoreboardEntry('p2', { score: 50 }),
      scoreboardEntry('p1', { score: 30 }),
    ]
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'end',
        roomMode: 'solo',
        scoreboard: sb,
        playerId: 'p1',
      }),
    )
    expect(result.current.christineMessage).toBe('End 30')
    expect(result.current.christineExpression).toBe('smile')
  })

  it('returns default end message when player not found in scoreboard', () => {
    const sb = [scoreboardEntry('p2', { score: 50 })]
    const { result } = renderHook(() =>
      useChristineMessages({
        ...defaults,
        phase: 'end',
        scoreboard: sb,
        playerId: 'unknown',
      }),
    )
    expect(result.current.christineMessage).toBe('End')
    expect(result.current.christineExpression).toBe('smile')
  })

  /* ── fallback ─────────────────────────────────────────────────── */

  it('returns empty message and smile for ready phase', () => {
    const { result } = renderHook(() =>
      useChristineMessages({ ...defaults, phase: 'ready' }),
    )
    expect(result.current.christineMessage).toBe('')
    expect(result.current.christineExpression).toBe('smile')
  })
})
