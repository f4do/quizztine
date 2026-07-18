import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import { listQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion } from '../questions.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockFindMany, mockFindUnique, mockCreate, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    question: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const publicQuestion = {
  id: 1,
  questionType: 'MCQ',
  text: 'What is 2+2?',
  choices: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }],
  category: 'Math',
  difficulty: 'EASY',
  visibility: 'PUBLIC',
  authorId: 'author1',
  explanation: '2+2 equals 4',
  sourceUrl: null,
  mediaUrl: null,
  mediaType: null,
  seedKey: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const privateQuestion = {
  ...publicQuestion,
  id: 2,
  visibility: 'PRIVATE',
  authorId: 'author1',
}

const otherPrivateQuestion = {
  ...publicQuestion,
  id: 3,
  visibility: 'PRIVATE',
  authorId: 'author2',
}

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

describe('listQuestions', () => {
  it('returns public questions for non-auth user', async () => {
    mockFindMany.mockResolvedValue([publicQuestion])

    const req = mockReq()
    const res = mockRes()
    await listQuestions(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
    })
    expect(res.json).toHaveBeenCalledWith({ questions: [publicQuestion] })
  })

  it('returns own private + public for quizmaster (default)', async () => {
    mockFindMany.mockResolvedValue([publicQuestion, privateQuestion])

    const req = mockReq({
      user: { id: 'author1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
    })
    const res = mockRes()
    await listQuestions(req, res)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.OR).toEqual([
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', authorId: 'author1' },
    ])
    expect(res.json).toHaveBeenCalledWith({ questions: [publicQuestion, privateQuestion] })
  })

  it('returns all for admin (no visibility filter)', async () => {
    mockFindMany.mockResolvedValue([publicQuestion, privateQuestion, otherPrivateQuestion])

    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()
    await listQuestions(req, res)

    const callArgs = mockFindMany.mock.calls[0][0]
    // Admin has no visibility constraint by default
    expect(callArgs.where.visibility).toBeUndefined()
    expect(callArgs.where.OR).toBeUndefined()
    expect(res.json).toHaveBeenCalledWith({
      questions: [publicQuestion, privateQuestion, otherPrivateQuestion],
    })
  })

  it('returns public-only for USER role (default)', async () => {
    mockFindMany.mockResolvedValue([publicQuestion])

    const req = mockReq({
      user: { id: 'user1', pseudo: 'user', email: 'user@test.com', role: 'USER' },
    })
    const res = mockRes()
    await listQuestions(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('filters by category', async () => {
    mockFindMany.mockResolvedValue([publicQuestion])

    const req = mockReq({ query: { category: 'Math' } })
    const res = mockRes()
    await listQuestions(req, res)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.visibility).toBe('PUBLIC')
    expect(callArgs.where.category).toBe('Math')
  })

  it('filters by difficulty', async () => {
    mockFindMany.mockResolvedValue([publicQuestion])

    const req = mockReq({ query: { difficulty: 'EASY' } })
    const res = mockRes()
    await listQuestions(req, res)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.difficulty).toBe('EASY')
  })

  it('admin with visibility=PRIVATE sees all private questions', async () => {
    mockFindMany.mockResolvedValue([privateQuestion, otherPrivateQuestion])

    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      query: { visibility: 'PRIVATE' },
    })
    const res = mockRes()
    await listQuestions(req, res)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.visibility).toBe('PRIVATE')
    expect(callArgs.where.OR).toBeUndefined()
  })

  it('quizmaster with visibility=PRIVATE sees own private + public', async () => {
    mockFindMany.mockResolvedValue([publicQuestion, privateQuestion])

    const req = mockReq({
      user: { id: 'author1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
      query: { visibility: 'PRIVATE' },
    })
    const res = mockRes()
    await listQuestions(req, res)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.OR).toEqual([
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', authorId: 'author1' },
    ])
  })
})

describe('getQuestion', () => {
  it('returns question by id', async () => {
    mockFindUnique.mockResolvedValue(publicQuestion)

    const req = mockReq({ params: { id: '1' } })
    const res = mockRes()
    await getQuestion(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(res.json).toHaveBeenCalledWith({ question: publicQuestion })
  })

  it('throws ValidationError for invalid id', async () => {
    const req = mockReq({ params: { id: 'abc' } })
    const res = mockRes()

    await expect(getQuestion(req, res)).rejects.toThrow(ValidationError)
  })

  it('throws NotFoundError for non-existent question', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: '999' } })
    const res = mockRes()

    await expect(getQuestion(req, res)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError for private question not owned by non-admin', async () => {
    mockFindUnique.mockResolvedValue(otherPrivateQuestion)

    const req = mockReq({
      params: { id: '3' },
      user: { id: 'author1', pseudo: 'user', email: 'user@test.com', role: 'USER' },
    })
    const res = mockRes()

    await expect(getQuestion(req, res)).rejects.toThrow(NotFoundError)
  })

  it('returns private question for the author', async () => {
    mockFindUnique.mockResolvedValue(privateQuestion)

    const req = mockReq({
      params: { id: '2' },
      user: { id: 'author1', pseudo: 'author', email: 'author@test.com', role: 'QUIZMASTER' },
    })
    const res = mockRes()
    await getQuestion(req, res)

    expect(res.json).toHaveBeenCalledWith({ question: privateQuestion })
  })

  it('returns private question for admin regardless of ownership', async () => {
    mockFindUnique.mockResolvedValue(otherPrivateQuestion)

    const req = mockReq({
      params: { id: '3' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()
    await getQuestion(req, res)

    expect(res.json).toHaveBeenCalledWith({ question: otherPrivateQuestion })
  })
})

describe('createQuestion', () => {
  const validInput = {
    text: 'What is the capital of France?',
    choices: [
      { text: 'London', isCorrect: false },
      { text: 'Paris', isCorrect: true },
      { text: 'Berlin', isCorrect: false },
    ],
    category: 'Geography',
    difficulty: 'EASY',
  }

  it('throws ForbiddenError for USER role', async () => {
    const req = mockReq({
      user: { id: 'user1', pseudo: 'user', email: 'user@test.com', role: 'USER' },
      body: validInput,
    })
    const res = mockRes()

    await expect(createQuestion(req, res)).rejects.toThrow(ForbiddenError)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws ForbiddenError when no user', async () => {
    const req = mockReq({ body: validInput })
    const res = mockRes()

    await expect(createQuestion(req, res)).rejects.toThrow(ForbiddenError)
  })

  it('creates question for QUIZMASTER', async () => {
    const createdQuestion = { ...validInput, id: 10, authorId: 'qm1', visibility: 'PUBLIC', questionType: 'MCQ' }
    mockCreate.mockResolvedValue(createdQuestion)

    const req = mockReq({
      user: { id: 'qm1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
      body: validInput,
    })
    const res = mockRes()
    await createQuestion(req, res)

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        ...validInput,
        questionType: 'MCQ',
        visibility: 'PUBLIC',
        choices: validInput.choices,
        authorId: 'qm1',
      },
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ question: createdQuestion })
  })

  it('creates question for QUIZADMIN', async () => {
    const createdQuestion = { ...validInput, id: 11, authorId: 'admin1', visibility: 'PUBLIC', questionType: 'MCQ' }
    mockCreate.mockResolvedValue(createdQuestion)

    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: validInput,
    })
    const res = mockRes()
    await createQuestion(req, res)

    expect(mockCreate).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('throws ValidationError on invalid input (empty text)', async () => {
    const req = mockReq({
      user: { id: 'qm1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
      body: { ...validInput, text: '' },
    })
    const res = mockRes()

    await expect(createQuestion(req, res)).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError on invalid input (too few choices)', async () => {
    const req = mockReq({
      user: { id: 'qm1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
      body: { ...validInput, choices: [{ text: 'Only', isCorrect: true }] },
    })
    const res = mockRes()

    await expect(createQuestion(req, res)).rejects.toThrow(ValidationError)
  })
})

describe('updateQuestion', () => {
  it('updates own question', async () => {
    mockFindUnique.mockResolvedValue(publicQuestion)
    mockUpdate.mockResolvedValue({ ...publicQuestion, text: 'Updated text' })

    const req = mockReq({
      params: { id: '1' },
      user: { id: 'author1', pseudo: 'author', email: 'author@test.com', role: 'QUIZMASTER' },
      body: { text: 'Updated text' },
    })
    const res = mockRes()
    await updateQuestion(req, res)

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { text: 'Updated text', questionType: 'MCQ', visibility: 'PUBLIC' },
    })
    expect(res.json).toHaveBeenCalledWith({
      question: { ...publicQuestion, text: 'Updated text' },
    })
  })

  it('updates any question as QUIZADMIN', async () => {
    mockFindUnique.mockResolvedValue(otherPrivateQuestion)
    mockUpdate.mockResolvedValue({ ...otherPrivateQuestion, text: 'Admin updated' })

    const req = mockReq({
      params: { id: '3' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { text: 'Admin updated' },
    })
    const res = mockRes()
    await updateQuestion(req, res)

    expect(mockUpdate).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalled()
  })

  it('throws ForbiddenError for non-author non-admin', async () => {
    mockFindUnique.mockResolvedValue(privateQuestion)

    const req = mockReq({
      params: { id: '2' },
      user: { id: 'other', pseudo: 'other', email: 'other@test.com', role: 'USER' },
      body: { text: 'Hacked' },
    })
    const res = mockRes()

    await expect(updateQuestion(req, res)).rejects.toThrow(ForbiddenError)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('throws NotFoundError for non-existent question', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({
      params: { id: '999' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { text: 'Nope' },
    })
    const res = mockRes()

    await expect(updateQuestion(req, res)).rejects.toThrow(NotFoundError)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('throws ValidationError for invalid id', async () => {
    const req = mockReq({
      params: { id: 'abc' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { text: 'test' },
    })
    const res = mockRes()

    await expect(updateQuestion(req, res)).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for invalid update data', async () => {
    mockFindUnique.mockResolvedValue(publicQuestion)

    const req = mockReq({
      params: { id: '1' },
      user: { id: 'author1', pseudo: 'author', email: 'author@test.com', role: 'QUIZMASTER' },
      body: { difficulty: 'INVALID' },
    })
    const res = mockRes()

    await expect(updateQuestion(req, res)).rejects.toThrow(ValidationError)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('deleteQuestion', () => {
  it('deletes own question', async () => {
    mockFindUnique.mockResolvedValue(publicQuestion)
    mockDelete.mockResolvedValue(publicQuestion)

    const req = mockReq({
      params: { id: '1' },
      user: { id: 'author1', pseudo: 'author', email: 'author@test.com', role: 'USER' },
    })
    const res = mockRes()
    await deleteQuestion(req, res)

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(res.json).toHaveBeenCalledWith({ message: 'Question deleted' })
  })

  it('deletes any question as QUIZADMIN', async () => {
    mockFindUnique.mockResolvedValue(otherPrivateQuestion)
    mockDelete.mockResolvedValue(otherPrivateQuestion)

    const req = mockReq({
      params: { id: '3' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()
    await deleteQuestion(req, res)

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 3 } })
  })

  it('throws ForbiddenError for non-author non-admin', async () => {
    mockFindUnique.mockResolvedValue(privateQuestion)

    const req = mockReq({
      params: { id: '2' },
      user: { id: 'other', pseudo: 'other', email: 'other@test.com', role: 'USER' },
    })
    const res = mockRes()

    await expect(deleteQuestion(req, res)).rejects.toThrow(ForbiddenError)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('throws NotFoundError for non-existent question', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({
      params: { id: '999' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()

    await expect(deleteQuestion(req, res)).rejects.toThrow(NotFoundError)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('throws ValidationError for invalid id', async () => {
    const req = mockReq({
      params: { id: 'abc' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()

    await expect(deleteQuestion(req, res)).rejects.toThrow(ValidationError)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
