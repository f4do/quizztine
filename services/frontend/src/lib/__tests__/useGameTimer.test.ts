import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameTimer } from '../useGameTimer'
import type { Phase } from '../useRoomGameTypes'

describe('useGameTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts timer when phase is "game" with correct initial value', () => {
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 30,
        questionId: 1,
        hasAnswered: false,
        onExpire: vi.fn(),
      }),
    )

    expect(result.current.timeLeft).toBe(30)
  })

  it('counts down every second', () => {
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 5,
        questionId: 1,
        hasAnswered: false,
        onExpire: vi.fn(),
      }),
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.timeLeft).toBe(4)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.timeLeft).toBe(3)
  })

  it('detects timer expiration at 0: timerExpired and onExpire', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 3,
        questionId: 1,
        hasAnswered: false,
        onExpire,
      }),
    )

    expect(result.current.timerExpired).toBe(false)
    expect(onExpire).not.toHaveBeenCalled()

    // Advance 2 seconds — not expired yet
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.timerExpired).toBe(false)
    expect(onExpire).not.toHaveBeenCalled()

    // Advance the final second — reaches 0
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.timeLeft).toBe(0)
    expect(result.current.timerExpired).toBe(true)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('does NOT expire when hasAnswered is true', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 3,
        questionId: 1,
        hasAnswered: true,
        onExpire,
      }),
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Timer still counts down internally, but expiration is blocked
    expect(result.current.timeLeft).toBe(0)
    expect(result.current.timerExpired).toBe(false)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('clearTimer stops the countdown', () => {
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 30,
        questionId: 1,
        hasAnswered: false,
        onExpire: vi.fn(),
      }),
    )

    // Let two ticks pass
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.timeLeft).toBe(28)

    // Stop the timer
    act(() => {
      result.current.clearTimer()
    })

    // Advance further — timeLeft should stay frozen
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.timeLeft).toBe(28)
    expect(result.current.timerExpired).toBe(false)
  })

  it('startFeedbackCountdown starts a 5-second countdown', () => {
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 30,
        questionId: 1,
        hasAnswered: false,
        onExpire: vi.fn(),
      }),
    )

    act(() => {
      result.current.startFeedbackCountdown()
    })
    expect(result.current.feedbackCountdown).toBe(5)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.feedbackCountdown).toBe(4)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.feedbackCountdown).toBe(2)
  })

  it('feedbackCountdown reaches 0 and stops', () => {
    const { result } = renderHook(() =>
      useGameTimer({
        phase: 'game',
        roomTimer: 30,
        questionId: 1,
        hasAnswered: false,
        onExpire: vi.fn(),
      }),
    )

    act(() => {
      result.current.startFeedbackCountdown()
    })
    expect(result.current.feedbackCountdown).toBe(5)

    // Advance full 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.feedbackCountdown).toBe(0)

    // Advance further — should stay at 0
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.feedbackCountdown).toBe(0)
  })

  it('is not active when phase is not "game"', () => {
    const phases: Phase[] = ['pre-game', 'ready', 'feedback', 'end']

    for (const phase of phases) {
      const { result } = renderHook(
        (p: Phase) =>
          useGameTimer({
            phase: p,
            roomTimer: 10,
            questionId: 1,
            hasAnswered: false,
            onExpire: vi.fn(),
          }),
        { initialProps: phase },
      )

      expect(result.current.timeLeft).toBe(0)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.timeLeft).toBe(0)
      expect(result.current.timerExpired).toBe(false)
    }
  })
})
