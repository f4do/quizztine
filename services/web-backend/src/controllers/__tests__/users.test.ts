import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import { listUsers, updateUser, deleteUser, resetUserPassword, resetUserTOTP } from '../users.js'
import { NotFoundError, ValidationError, ForbiddenError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockHash } = vi.hoisted(() => ({
  mockHash: vi.fn(),
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: mockHash,
  },
}))

const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  question: { updateMany: vi.fn() },
  questionReport: { updateMany: vi.fn() },
  room: { updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => {
    for (const op of ops) await op
  }),
}))

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }))

function mockReq(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    body: {},
    user: { id: 'admin1', pseudo: 'admin1', email: 'admin1@test.com', role: 'QUIZADMIN' },
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

describe('listUsers', () => {
  it('returns a list of users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER', totpEnabled: false, emailVerified: true, createdAt: new Date('2026-01-01') },
    ])

    const req = mockReq()
    const res = mockRes()

    await listUsers(req, res)

    expect(mockPrisma.user.findMany).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      users: [{ id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER', totpEnabled: false, emailVerified: true, createdAt: new Date('2026-01-01') }],
    })
  })
})

describe('updateUser', () => {
  it('updates role and returns user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' })
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({
      id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'QUIZMASTER', totpEnabled: false, emailVerified: true, createdAt: new Date('2026-01-01'),
    })

    const req = mockReq({ params: { id: 'u1' }, body: { role: 'QUIZMASTER' } })
    const res = mockRes()

    await updateUser(req, res)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'QUIZMASTER' },
      select: { id: true, pseudo: true, email: true, role: true, totpEnabled: true, emailVerified: true, createdAt: true },
    })
    expect(res.json).toHaveBeenCalled()
  })

  it('rejects self-demotion from QUIZADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin1', role: 'QUIZADMIN' })

    const req = mockReq({ params: { id: 'admin1' }, body: { role: 'USER' } })
    const res = mockRes()

    await expect(updateUser(req, res)).rejects.toThrow(ForbiddenError)
  })

  it('rejects duplicate pseudo or email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' })
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u2' })

    const req = mockReq({ params: { id: 'u1' }, body: { pseudo: 'bob' } })
    const res = mockRes()

    await expect(updateUser(req, res)).rejects.toThrow(ValidationError)
  })

  it('throws NotFoundError when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'unknown' }, body: { role: 'USER' } })
    const res = mockRes()

    await expect(updateUser(req, res)).rejects.toThrow(NotFoundError)
  })
})

describe('deleteUser', () => {
  it('deletes another user and detaches relations', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' })

    const req = mockReq({ params: { id: 'u1' } })
    const res = mockRes()

    await deleteUser(req, res)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
    expect(res.json).toHaveBeenCalledWith({ message: 'User deleted successfully' })
  })

  it('prevents self-deletion', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin1' })

    const req = mockReq({ params: { id: 'admin1' } })
    const res = mockRes()

    await expect(deleteUser(req, res)).rejects.toThrow(ForbiddenError)
  })
})

describe('resetUserPassword', () => {
  it('resets password when passwords match', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' })
    mockHash.mockResolvedValue('hashed')
    mockPrisma.user.update.mockResolvedValue({})

    const req = mockReq({ params: { id: 'u1' }, body: { password: 'newpassword1234', confirmPassword: 'newpassword1234' } })
    const res = mockRes()

    await resetUserPassword(req, res)

    expect(mockHash).toHaveBeenCalledWith('newpassword1234', 12)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'hashed' },
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Password reset successfully' })
  })

  it('rejects mismatched passwords', async () => {
    const req = mockReq({ params: { id: 'u1' }, body: { password: 'newpassword1234', confirmPassword: 'different1234' } })
    const res = mockRes()

    await expect(resetUserPassword(req, res)).rejects.toThrow(ValidationError)
  })
})

describe('resetUserTOTP', () => {
  it('disables TOTP for the user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' })
    mockPrisma.user.update.mockResolvedValue({})

    const req = mockReq({ params: { id: 'u1' } })
    const res = mockRes()

    await resetUserTOTP(req, res)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { totpSecret: null, totpEnabled: false },
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'TOTP reset successfully' })
  })
})
