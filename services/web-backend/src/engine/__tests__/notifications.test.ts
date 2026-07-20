import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyBackend } from '../notifications.js'

const { mockHandleQuestionFinished, mockHandleNextQuestion, mockHandleGameFinished, mockHandleReceiveResults } =
  vi.hoisted(() => ({
    mockHandleQuestionFinished: vi.fn(),
    mockHandleNextQuestion: vi.fn(),
    mockHandleGameFinished: vi.fn(),
    mockHandleReceiveResults: vi.fn(),
  }))

vi.mock('../../controllers/room-events.js', () => ({
  handleQuestionFinished: mockHandleQuestionFinished,
  handleNextQuestion: mockHandleNextQuestion,
  handleGameFinished: mockHandleGameFinished,
}))

vi.mock('../../controllers/results.js', () => ({
  handleReceiveResults: mockHandleReceiveResults,
}))

vi.mock('../../lib/logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyBackend', () => {
  it('dispatches question-finished', async () => {
    const payload = { questionId: 1, correctChoices: [0], results: [] }
    await notifyBackend('room-1', 'question-finished', payload)

    expect(mockHandleQuestionFinished).toHaveBeenCalledWith('room-1', payload)
  })

  it('dispatches next-question', async () => {
    const payload = { questionIndex: 2 }
    await notifyBackend('room-1', 'next-question', payload)

    expect(mockHandleNextQuestion).toHaveBeenCalledWith('room-1', payload)
  })

  it('dispatches game-finished', async () => {
    await notifyBackend('room-1', 'game-finished')

    expect(mockHandleGameFinished).toHaveBeenCalledWith('room-1')
  })

  it('dispatches results', async () => {
    const payload = {
      scores: [{ playerId: 'p1', nickname: 'Alice', score: 50, streak: 3, cumulativeTime: 12.5 }],
      answers: [{ playerId: 'p1', questionId: 1, correct: true, timeSpent: 5.2 }],
    }
    await notifyBackend('room-1', 'results', payload)

    expect(mockHandleReceiveResults).toHaveBeenCalledWith('room-1', payload.scores, payload.answers)
  })

  it('logs warning for unknown event', async () => {
    const logger = await import('../../lib/logger.js')

    await notifyBackend('room-1', 'unknown-event')

    expect(mockHandleQuestionFinished).not.toHaveBeenCalled()
    expect(logger.default.warn).toHaveBeenCalled()
  })

  it('logs error and does not throw when handler throws', async () => {
    mockHandleNextQuestion.mockImplementation(() => { throw new Error('handler failed') })
    const logger = await import('../../lib/logger.js')

    await expect(notifyBackend('room-1', 'next-question', {})).resolves.toBeUndefined()

    expect(logger.default.error).toHaveBeenCalled()
  })
})
