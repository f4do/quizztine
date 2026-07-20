import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupStatus, setup } from '../setup.js'
import { AppError } from '../../types/errors.js'
import { mockReq, mockRes } from '../../test/utils.js'

const { mockBcryptHash, mockSignAccessToken, mockSignRefreshToken, mockSetTokenCookies, mockLoadSeedData, mockUserCount, mockTransaction, mockCategoryUpsert, mockQuestionUpsert, mockHostUpsert } = vi.hoisted(() => ({
  mockBcryptHash: vi.fn().mockResolvedValue('$2a$12$hashedfake'),
  mockSignAccessToken: vi.fn().mockResolvedValue('access-token'),
  mockSignRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
  mockSetTokenCookies: vi.fn(),
  mockLoadSeedData: vi.fn(),
  mockUserCount: vi.fn(),
  mockTransaction: vi.fn(),
  mockCategoryUpsert: vi.fn(),
  mockQuestionUpsert: vi.fn(),
  mockHostUpsert: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: mockBcryptHash },
  hash: mockBcryptHash,
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { count: mockUserCount },
    $transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
    category: { upsert: mockCategoryUpsert },
    question: { upsert: mockQuestionUpsert },
    host: { upsert: mockHostUpsert },
  },
}))

vi.mock('../../lib/jwt.js', () => ({
  signAccessToken: mockSignAccessToken,
  signRefreshToken: mockSignRefreshToken,
}))

vi.mock('../auth.js', () => ({
  setTokenCookies: mockSetTokenCookies,
}))

vi.mock('../../seed-data/index.js', () => ({
  loadSeedData: mockLoadSeedData,
}))

const mockSeedData = {
  language: 'fr' as const,
  categories: [{ name: 'Sciences' }, { name: 'Histoire' }],
  questions: [
    {
      seedKey: 'fr-sci-001',
      text: 'Question test ?',
      difficulty: 'EASY' as const,
      category: 'Sciences',
      choices: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }, { text: 'C', isCorrect: false }, { text: 'D', isCorrect: false }],
      explanation: 'Explication test.',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLoadSeedData.mockReturnValue(mockSeedData)
  mockBcryptHash.mockResolvedValue('$2a$12$hashedfake')
  mockSignAccessToken.mockResolvedValue('access-token')
  mockSignRefreshToken.mockResolvedValue('refresh-token')
})

describe('setupStatus', () => {
  it('returns needsSetup: true when no admin exists', async () => {
    mockUserCount.mockResolvedValue(0)
    const req = mockReq()
    const res = mockRes()

    await setupStatus(req, res)

    expect(mockUserCount).toHaveBeenCalledWith({ where: { role: 'QUIZADMIN' } })
    expect(res.json).toHaveBeenCalledWith({ needsSetup: true })
  })

  it('returns needsSetup: false when an admin exists', async () => {
    mockUserCount.mockResolvedValue(1)
    const req = mockReq()
    const res = mockRes()

    await setupStatus(req, res)

    expect(res.json).toHaveBeenCalledWith({ needsSetup: false })
  })
})

describe('setup', () => {
  it('creates admin and seeds data on first setup', async () => {
    const fakeUser = { id: 'admin-1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN', language: 'fr', theme: 'light' }

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        user: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue(fakeUser) },
        category: { upsert: mockCategoryUpsert },
        question: { upsert: mockQuestionUpsert },
      }
      return await fn(tx)
    })

    const req = mockReq({
      body: {
        pseudo: 'admin',
        email: 'admin@test.com',
        password: 'supersecret1234',
        confirmPassword: 'supersecret1234',
        language: 'fr',
      },
    })
    const res = mockRes()

    await setup(req, res)

    expect(mockBcryptHash).toHaveBeenCalledWith('supersecret1234', 12)
    expect(mockLoadSeedData).toHaveBeenCalledWith('fr')
    expect(mockSignAccessToken).toHaveBeenCalled()
    expect(mockSignRefreshToken).toHaveBeenCalled()
    expect(mockSetTokenCookies).toHaveBeenCalled()
    expect(mockHostUpsert).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'admin-1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN', language: 'fr', theme: 'light' },
    })
  })

  it('rejects setup when admin already exists', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        user: { count: vi.fn().mockResolvedValue(1) },
      }
      return await fn(tx)
    })

    const req = mockReq({
      body: {
        pseudo: 'admin',
        email: 'admin@test.com',
        password: 'supersecret1234',
        confirmPassword: 'supersecret1234',
        language: 'fr',
      },
    })
    const res = mockRes()

    await expect(setup(req, res)).rejects.toThrow(AppError)
    await expect(setup(req, res)).rejects.toThrow('An admin already exists')
  })

  it('validates password mismatch', async () => {
    const req = mockReq({
      body: {
        pseudo: 'admin',
        email: 'admin@test.com',
        password: 'supersecret1234',
        confirmPassword: 'differentpassword',
        language: 'fr',
      },
    })
    const res = mockRes()

    await expect(setup(req, res)).rejects.toThrow(AppError)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('validates short password', async () => {
    const req = mockReq({
      body: {
        pseudo: 'admin',
        email: 'admin@test.com',
        password: 'short',
        confirmPassword: 'short',
        language: 'fr',
      },
    })
    const res = mockRes()

    await expect(setup(req, res)).rejects.toThrow(AppError)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('validates invalid language', async () => {
    const req = mockReq({
      body: {
        pseudo: 'admin',
        email: 'admin@test.com',
        password: 'supersecret1234',
        confirmPassword: 'supersecret1234',
        language: 'de',
      },
    })
    const res = mockRes()

    await expect(setup(req, res)).rejects.toThrow(AppError)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('works with English language', async () => {
    const fakeUser = { id: 'admin-1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN', language: 'en', theme: 'light' }

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        user: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue(fakeUser) },
        category: { upsert: mockCategoryUpsert },
        question: { upsert: mockQuestionUpsert },
      }
      return await fn(tx)
    })

    const englishSeedData = {
      ...mockSeedData,
      language: 'en' as const,
      categories: [{ name: 'Science' }, { name: 'History' }],
    }
    mockLoadSeedData.mockReturnValue(englishSeedData)

    const req = mockReq({
      body: {
        pseudo: 'admin',
        email: 'admin@test.com',
        password: 'supersecret1234',
        confirmPassword: 'supersecret1234',
        language: 'en',
      },
    })
    const res = mockRes()

    await setup(req, res)

    expect(mockLoadSeedData).toHaveBeenCalledWith('en')
    expect(res.status).toHaveBeenCalledWith(201)
  })
})
