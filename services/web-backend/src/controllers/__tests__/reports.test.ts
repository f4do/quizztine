import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import { reportQuestion } from '../reports.js'
import { ValidationError, NotFoundError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockFindUnique, mockReportCreate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockReportCreate: vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    question: {
      findUnique: mockFindUnique,
    },
    questionReport: {
      create: mockReportCreate,
    },
  },
}))

const mockQuestion = { id: 1, text: 'Test question', visibility: 'PUBLIC' }

function mockReq(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    body: {},
    user: undefined,
    params: {},
    query: {},
    cookies: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
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

describe('reportQuestion', () => {
  it('throws ValidationError for invalid questionId', async () => {
    const req = mockReq({ params: { questionId: 'abc' }, body: { reason: 'Bad question' } })
    const res = mockRes()

    await expect(reportQuestion(req, res)).rejects.toThrow(ValidationError)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('throws ValidationError for missing reason', async () => {
    const req = mockReq({ params: { questionId: '1' }, body: {} })
    const res = mockRes()

    await expect(reportQuestion(req, res)).rejects.toThrow(ValidationError)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('throws ValidationError for empty reason', async () => {
    const req = mockReq({ params: { questionId: '1' }, body: { reason: '' } })
    const res = mockRes()

    await expect(reportQuestion(req, res)).rejects.toThrow(ValidationError)
  })

  it('throws NotFoundError for non-existent question', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({ params: { questionId: '999' }, body: { reason: 'Not found test' } })
    const res = mockRes()

    await expect(reportQuestion(req, res)).rejects.toThrow(NotFoundError)
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('creates report for authenticated user', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    mockReportCreate.mockResolvedValue({ id: 'r1', questionId: 1, reporterId: 'user1', reason: 'Incorrect answer' })

    const req = mockReq({
      params: { questionId: '1' },
      body: { reason: 'Incorrect answer' },
      user: { id: 'user1', pseudo: 'testuser', email: 'test@test.com', role: 'USER' },
    })
    const res = mockRes()
    await reportQuestion(req, res)

    expect(mockReportCreate).toHaveBeenCalledWith({
      data: {
        questionId: 1,
        reporterId: 'user1',
        reason: 'Incorrect answer',
      },
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Report submitted' })
  })

  it('creates report for anonymous user (IP-based)', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    mockReportCreate.mockResolvedValue({ id: 'r2', questionId: 1, reporterId: null, reason: 'Spam' })

    const req = mockReq({
      params: { questionId: '1' },
      body: { reason: 'Spam' },
      ip: '192.168.1.42',
    })
    const res = mockRes()
    await reportQuestion(req, res)

    expect(mockReportCreate).toHaveBeenCalledWith({
      data: {
        questionId: 1,
        reporterId: null,
        reason: 'Spam',
      },
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Report submitted' })
  })

  it('trims reason before saving', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    mockReportCreate.mockResolvedValue({ id: 'r3', questionId: 1, reporterId: null, reason: 'Typo' })

    const req = mockReq({
      params: { questionId: '1' },
      body: { reason: '  Typo  ' },
    })
    const res = mockRes()
    await reportQuestion(req, res)

    expect(mockReportCreate).toHaveBeenCalledWith({
      data: {
        questionId: 1,
        reporterId: null,
        reason: 'Typo',
      },
    })
  })

  it('rate limits anonymous user (3/h)', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    const uniqueIp = '10.0.0.99'

    // 3 calls should succeed
    for (let i = 0; i < 3; i++) {
      vi.clearAllMocks()
      mockFindUnique.mockResolvedValue(mockQuestion)
      mockReportCreate.mockResolvedValue({ id: `r${i}` })

      const req = mockReq({
        params: { questionId: '1' },
        body: { reason: 'Rate test' },
        ip: uniqueIp,
      })
      const res = mockRes()
      await reportQuestion(req, res)

      expect(res.json).toHaveBeenCalledWith({ message: 'Report submitted' })
    }

    // 4th call should be rate limited
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue(mockQuestion)

    const req = mockReq({
      params: { questionId: '1' },
      body: { reason: 'Rate test' },
      ip: uniqueIp,
    })
    const res = mockRes()
    await reportQuestion(req, res)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many reports. Please try again later.',
      code: 'RATE_LIMITED',
      status: 429,
    })
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('rate limits authenticated user (10/h)', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    const userId = 'rate-limited-user'

    // 10 calls should succeed
    for (let i = 0; i < 10; i++) {
      vi.clearAllMocks()
      mockFindUnique.mockResolvedValue(mockQuestion)
      mockReportCreate.mockResolvedValue({ id: `r${i}` })

      const req = mockReq({
        params: { questionId: '1' },
        body: { reason: 'User rate test' },
        user: { id: userId, pseudo: 'ratelimited', email: 'rl@test.com', role: 'USER' },
      })
      const res = mockRes()
      await reportQuestion(req, res)

      expect(res.json).toHaveBeenCalledWith({ message: 'Report submitted' })
    }

    // 11th call should be rate limited
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue(mockQuestion)

    const req = mockReq({
      params: { questionId: '1' },
      body: { reason: 'User rate test' },
      user: { id: userId, pseudo: 'ratelimited', email: 'rl@test.com', role: 'USER' },
    })
    const res = mockRes()
    await reportQuestion(req, res)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many reports. Try again later.',
      code: 'RATE_LIMITED',
      status: 429,
    })
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('does not rate limit quizmaster+', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    const quizmasterId = 'unlimited-qm'

    // Make 15 calls (more than the 10/h user limit) - should all succeed
    for (let i = 0; i < 15; i++) {
      vi.clearAllMocks()
      mockFindUnique.mockResolvedValue(mockQuestion)
      mockReportCreate.mockResolvedValue({ id: `r${i}` })

      const req = mockReq({
        params: { questionId: '1' },
        body: { reason: 'QM rate test' },
        user: { id: quizmasterId, pseudo: 'quizmaster', email: 'qm@test.com', role: 'QUIZMASTER' },
      })
      const res = mockRes()
      await reportQuestion(req, res)

      expect(res.json).toHaveBeenCalledWith({ message: 'Report submitted' })
    }
  })

  it('does not rate limit admin', async () => {
    mockFindUnique.mockResolvedValue(mockQuestion)
    const adminId = 'unlimited-admin'

    for (let i = 0; i < 15; i++) {
      vi.clearAllMocks()
      mockFindUnique.mockResolvedValue(mockQuestion)
      mockReportCreate.mockResolvedValue({ id: `r${i}` })

      const req = mockReq({
        params: { questionId: '1' },
        body: { reason: 'Admin rate test' },
        user: { id: adminId, pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      })
      const res = mockRes()
      await reportQuestion(req, res)

      expect(res.json).toHaveBeenCalledWith({ message: 'Report submitted' })
    }
  })
})
