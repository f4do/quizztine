import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import { receiveResults, getResults, getMyStats } from '../results.js'
import { NotFoundError, ValidationError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockPrisma, mockTxMethods } = vi.hoisted(() => {
  const txMethods = {
    room: { findUnique: vi.fn(), update: vi.fn() },
    gameResult: { create: vi.fn() },
    user: { findMany: vi.fn() },
    userStat: { upsert: vi.fn() },
    question: { findMany: vi.fn() },
    userThemeStat: { upsert: vi.fn() },
  }
  const prismaMock = {
    $transaction: vi.fn(async (fn: (tx: typeof txMethods) => Promise<unknown>) => fn(txMethods)),
    gameResult: { findUnique: vi.fn() },
    userStat: { findUnique: vi.fn() },
    userThemeStat: { findMany: vi.fn() },
  }
  return { mockPrisma: prismaMock, mockTxMethods: txMethods }
})

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }))

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

describe('receiveResults', () => {
  const payload = {
    scores: [
      { player_id: 'alice-123', nickname: 'alice', score: 25, streak: 1, cumulative_time: 12.5 },
    ],
    answers: [
      { player_id: 'alice-123', question_id: 1, correct: true, time_spent: 5.2 },
      { player_id: 'alice-123', question_id: 2, correct: false, time_spent: 7.3 },
    ],
  }

  it('persists results and updates room status', async () => {
    mockTxMethods.room.findUnique.mockResolvedValue({ id: 'r1', mode: 'solo' })
    mockTxMethods.room.update.mockResolvedValue({})
    mockTxMethods.gameResult.create.mockResolvedValue({ id: 'gr1' })
    mockTxMethods.user.findMany.mockResolvedValue([{ id: 'u1', pseudo: 'alice' }])
    mockTxMethods.userStat.upsert.mockResolvedValue({})
    mockTxMethods.question.findMany.mockResolvedValue([
      { id: 1, category: 'Science' },
      { id: 2, category: 'Science' },
    ])
    mockTxMethods.userThemeStat.upsert.mockResolvedValue({})

    const req = mockReq({ params: { id: 'r1' }, body: payload })
    const res = mockRes()

    await receiveResults(req, res)

    expect(mockTxMethods.room.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } })
    expect(mockTxMethods.room.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'finished' } })
    expect(mockTxMethods.gameResult.create).toHaveBeenCalled()
    expect(mockTxMethods.userStat.upsert).toHaveBeenCalled()
    expect(mockTxMethods.userThemeStat.upsert).toHaveBeenCalledTimes(2)
    expect(res.json).toHaveBeenCalledWith({ message: 'Results received' })
  })

  it('throws NotFoundError when room does not exist', async () => {
    mockTxMethods.room.findUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'unknown' }, body: payload })
    const res = mockRes()

    await expect(receiveResults(req, res)).rejects.toThrow(NotFoundError)
  })

  it('throws ValidationError on invalid payload', async () => {
    const req = mockReq({ params: { id: 'r1' }, body: { scores: [] } })
    const res = mockRes()

    await expect(receiveResults(req, res)).rejects.toThrow(ValidationError)
  })
})

describe('getResults', () => {
  it('returns persisted results', async () => {
    const data = { id: 'gr1', roomId: 'r1', mode: 'solo', scores: [], answers: [] }
    mockPrisma.gameResult.findUnique.mockResolvedValue(data)

    const req = mockReq({ params: { id: 'r1' } })
    const res = mockRes()

    await getResults(req, res)

    expect(mockPrisma.gameResult.findUnique).toHaveBeenCalledWith({
      where: { roomId: 'r1' },
      include: { scores: true, answers: true },
    })
    expect(res.json).toHaveBeenCalledWith({ result: data })
  })

  it('throws NotFoundError when results not found', async () => {
    mockPrisma.gameResult.findUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'r1' } })
    const res = mockRes()

    await expect(getResults(req, res)).rejects.toThrow(NotFoundError)
  })
})

describe('getMyStats', () => {
  it('returns stats and theme stats', async () => {
    mockPrisma.userStat.findUnique.mockResolvedValue({ userId: 'u1', gamesPlayed: 3, totalScore: 75 })
    mockPrisma.userThemeStat.findMany.mockResolvedValue([
      { category: 'Science', totalAnswered: 10, correctCount: 7 },
    ])

    const req = mockReq({ user: { id: 'u1', pseudo: 'alice', email: 'a@t.com', role: 'USER' } })
    const res = mockRes()

    await getMyStats(req, res)

    expect(res.json).toHaveBeenCalledWith({
      stat: { userId: 'u1', gamesPlayed: 3, totalScore: 75 },
      themeStats: [{ category: 'Science', totalAnswered: 10, correctCount: 7, successRate: 70 }],
    })
  })

  it('returns zeros when no stats exist', async () => {
    mockPrisma.userStat.findUnique.mockResolvedValue(null)
    mockPrisma.userThemeStat.findMany.mockResolvedValue([])

    const req = mockReq({ user: { id: 'u1', pseudo: 'alice', email: 'a@t.com', role: 'USER' } })
    const res = mockRes()

    await getMyStats(req, res)

    expect(res.json).toHaveBeenCalledWith({
      stat: { gamesPlayed: 0, totalScore: 0 },
      themeStats: [],
    })
  })
})
