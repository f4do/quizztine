import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMe, updateMe, updateMyPassword, deleteMe } from '../users.js'
import { mockReq, mockRes } from '../../test/utils.js'
import { AuthError, NotFoundError, ValidationError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockCompare, mockHash } = vi.hoisted(() => ({
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockCompare,
    hash: mockHash,
  },
}))

const mockPrisma = vi.hoisted(() => ({
  user: {
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMe', () => {
  it('returns sanitized current user', async () => {
    const createdAt = new Date('2026-01-01')
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      pseudo: 'alice',
      email: 'alice@test.com',
      role: 'USER',
      language: 'fr',
      theme: 'light',
      emailVerified: true,
      createdAt,
    })

    const req = mockReq({ user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await getMe(req, res)

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } })
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'u1',
        pseudo: 'alice',
        email: 'alice@test.com',
        role: 'USER',
        language: 'fr',
        theme: 'light',
        emailVerified: true,
        createdAt: createdAt.toISOString(),
      },
    })
  })

  it('throws AuthError when not authenticated', async () => {
    const req = mockReq({ user: undefined })
    const res = mockRes()
    await expect(getMe(req, res)).rejects.toThrow(AuthError)
  })
})

describe('updateMe', () => {
  it('updates pseudo and email', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.update.mockResolvedValue({
      id: 'u1',
      pseudo: 'alice2',
      email: 'alice2@test.com',
      role: 'USER',
      language: 'fr',
      theme: 'light',
      emailVerified: true,
      createdAt: new Date('2026-01-01'),
    })

    const req = mockReq({ body: { pseudo: 'alice2', email: 'alice2@test.com' }, user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await updateMe(req, res)

    expect(mockPrisma.user.findFirst).toHaveBeenCalled()
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { pseudo: 'alice2', email: 'alice2@test.com' },
    })
    expect(res.json).toHaveBeenCalled()
  })

  it('rejects duplicate pseudo or email', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u2' })

    const req = mockReq({ body: { pseudo: 'bob' }, user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await expect(updateMe(req, res)).rejects.toThrow(ValidationError)
  })

  it('rejects empty payload', async () => {
    const req = mockReq({ body: {}, user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await expect(updateMe(req, res)).rejects.toThrow(ValidationError)
  })
})

describe('updateMyPassword', () => {
  it('updates password when current is valid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' })
    mockCompare.mockResolvedValue(true)
    mockHash.mockResolvedValue('newHashed')
    mockPrisma.user.update.mockResolvedValue({})

    const req = mockReq({
      body: { currentPassword: 'oldpassword1234', password: 'newpassword1234', confirmPassword: 'newpassword1234' },
      user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' },
    })
    const res = mockRes()

    await updateMyPassword(req, res)

    expect(mockCompare).toHaveBeenCalledWith('oldpassword1234', 'hashed')
    expect(mockHash).toHaveBeenCalledWith('newpassword1234', 12)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'newHashed' },
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Password updated successfully' })
  })

  it('rejects wrong current password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' })
    mockCompare.mockResolvedValue(false)

    const req = mockReq({
      body: { currentPassword: 'wrong', password: 'newpassword1234', confirmPassword: 'newpassword1234' },
      user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' },
    })
    const res = mockRes()

    await expect(updateMyPassword(req, res)).rejects.toThrow(AuthError)
  })
})

describe('deleteMe', () => {
  it('deletes account and clears cookies when password is valid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' })
    mockCompare.mockResolvedValue(true)

    const req = mockReq({ body: { password: 'password1234' }, user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await deleteMe(req, res)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
    expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' })
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' })
    expect(res.json).toHaveBeenCalledWith({ message: 'Account deleted successfully' })
  })

  it('rejects missing password', async () => {
    const req = mockReq({ body: {}, user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await expect(deleteMe(req, res)).rejects.toThrow(ValidationError)
  })

  it('rejects wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' })
    mockCompare.mockResolvedValue(false)

    const req = mockReq({ body: { password: 'wrong' }, user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER' } })
    const res = mockRes()

    await expect(deleteMe(req, res)).rejects.toThrow(AuthError)
  })
})
