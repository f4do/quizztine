import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import { questionFinished, nextQuestion, gameFinished } from '../room-events.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const mockEmit = vi.fn()
const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })

vi.mock('../../lib/socket.js', () => ({
  getIO: vi.fn(() => ({
    to: mockTo,
  })),
}))

function mockReq(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    body: {},
    user: undefined,
    params: {},
    query: {},
    cookies: {},
    ...overrides,
  } as unknown as AuthenticatedRequest
}

function mockRes(): Response {
  const res: Record<string, unknown> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('room-events controllers', () => {
  const roomId = 'r1'

  it('questionFinished validates and broadcasts question-feedback', () => {
    const req = mockReq({
      params: { id: roomId },
      body: {
        question_id: 7,
        correct_choices: [0, 2],
        results: [
          { player_id: 'p1', nickname: 'Alice', correct: true, points: 15, bonus: 0, streak: 1, cumulative_time: 3.5 },
        ],
      },
    })
    const res = mockRes()

    questionFinished(req, res)

    expect(mockTo).toHaveBeenCalledWith(`room:${roomId}`)
    expect(mockEmit).toHaveBeenCalledWith('question-feedback', req.body)
    expect(res.json).toHaveBeenCalledWith({ message: 'Question finished event broadcasted' })
  })

  it('questionFinished rejects invalid payloads', () => {
    const req = mockReq({ params: { id: roomId }, body: { question_id: 'not-a-number' } })
    const res = mockRes()

    questionFinished(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('nextQuestion broadcasts next-question', () => {
    const req = mockReq({ params: { id: roomId }, body: { question_index: 2 } })
    const res = mockRes()

    nextQuestion(req, res)

    expect(mockTo).toHaveBeenCalledWith(`room:${roomId}`)
    expect(mockEmit).toHaveBeenCalledWith('next-question', { question_index: 2 })
    expect(res.json).toHaveBeenCalledWith({ message: 'Next question event broadcasted' })
  })

  it('gameFinished broadcasts game-finished', () => {
    const req = mockReq({ params: { id: roomId } })
    const res = mockRes()

    gameFinished(req, res)

    expect(mockTo).toHaveBeenCalledWith(`room:${roomId}`)
    expect(mockEmit).toHaveBeenCalledWith('game-finished', {})
    expect(res.json).toHaveBeenCalledWith({ message: 'Game finished event broadcasted' })
  })
})
