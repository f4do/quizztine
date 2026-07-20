import { describe, it, expect, vi, beforeEach } from 'vitest'
import { register, login, refresh, logout } from '../auth.js'
import { mockReq, mockRes } from '../../test/utils.js'
import { ValidationError, AuthError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockFindFirst, mockCreate, mockFindUnique, mockRevokedTokenFindUnique, mockRevokedTokenCreate, mockUserUpdate } =
  vi.hoisted(() => ({
    mockFindFirst: vi.fn(),
    mockCreate: vi.fn(),
    mockFindUnique: vi.fn(),
    mockRevokedTokenFindUnique: vi.fn(),
    mockRevokedTokenCreate: vi.fn(),
    mockUserUpdate: vi.fn(),
  }))

const { mockBcryptCompare, mockBcryptHash } = vi.hoisted(() => ({
  mockBcryptCompare: vi.fn(),
  mockBcryptHash: vi.fn().mockResolvedValue('$2a$12$hashedfake'),
}))

vi.mock('bcryptjs', () => ({
  default: { compare: mockBcryptCompare, hash: mockBcryptHash },
  compare: mockBcryptCompare,
  hash: mockBcryptHash,
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findFirst: mockFindFirst,
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUserUpdate,
    },
    revokedToken: {
      findUnique: mockRevokedTokenFindUnique,
      create: mockRevokedTokenCreate,
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('register', () => {
  it('rejects mismatched password and confirmPassword', async () => {
    const req = mockReq({
      body: {
        pseudo: 'alice',
        email: 'alice@test.com',
        password: 'supersecret1234',
        confirmPassword: 'differentpassword',
      },
    })
    const res = mockRes()

    await expect(register(req, res)).rejects.toThrow(ValidationError)
    expect(mockFindFirst).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates user when passwords match', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'u1', pseudo: 'alice', email: 'alice@test.com' })

    const req = mockReq({
      body: {
        pseudo: 'alice',
        email: 'alice@test.com',
        password: 'supersecret1234',
        confirmPassword: 'supersecret1234',
      },
    })
    const res = mockRes()

    await register(req, res)

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ pseudo: 'alice' }, { email: 'alice@test.com' }] },
    })
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pseudo: 'alice',
        email: 'alice@test.com',
        password: expect.any(String),
        verificationToken: expect.any(String),
      }),
    })
    expect(res.status).toHaveBeenCalledWith(201)
  })
})

describe('refresh', () => {
  it('throws AuthError when no refresh token cookie is present', async () => {
    const req = mockReq({ cookies: {} })
    const res = mockRes()
    await expect(refresh(req, res)).rejects.toThrow(AuthError)
  })

  it('throws AuthError when refresh token is revoked (in blacklist)', async () => {
    // Mock: token IS found in revokedToken table → isTokenRevoked returns true
    mockRevokedTokenFindUnique.mockResolvedValue({ tokenHash: 'somehash' })

    const req = mockReq({ cookies: { refresh_token: 'revoked-token' } })
    const res = mockRes()
    await expect(refresh(req, res)).rejects.toThrow(AuthError)
    expect(mockRevokedTokenFindUnique).toHaveBeenCalled()
  })

  it('throws AuthError when token is not revoked but invalid JWT', async () => {
    // Token not in blacklist
    mockRevokedTokenFindUnique.mockResolvedValue(null)

    const req = mockReq({ cookies: { refresh_token: 'not-a-valid-jwt' } })
    const res = mockRes()
    // verifyToken will throw because it's not a valid JWT → caught and rethrown as AuthError
    await expect(refresh(req, res)).rejects.toThrow(AuthError)
  })
})

describe('logout', () => {
  it('clears access_token and refresh_token cookies', async () => {
    const req = mockReq({ cookies: {} })
    const res = mockRes()

    await logout(req, res)

    expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' })
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' })
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' })
  })

  it('revokes refresh token when present in cookie', async () => {
    mockRevokedTokenCreate.mockResolvedValue({})

    const req = mockReq({ cookies: { refresh_token: 'some-refresh-token' } })
    const res = mockRes()

    await logout(req, res)

    expect(mockRevokedTokenCreate).toHaveBeenCalled()
    expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' })
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' })
  })

  it('does not throw when revokeRefreshToken fails (duplicate/already expired)', async () => {
    mockRevokedTokenCreate.mockRejectedValue(new Error('Duplicate entry'))

    const req = mockReq({ cookies: { refresh_token: 'some-token' } })
    const res = mockRes()

    // Should not throw — logout swallows revoke errors
    await expect(logout(req, res)).resolves.toBeUndefined()
    expect(res.clearCookie).toHaveBeenCalled()
  })
})

describe('login', () => {
  const mockUser = {
    id: 'u1', pseudo: 'alice', email: 'alice@test.com',
    password: '$2a$12$hashedfake', role: 'USER', language: 'fr', theme: 'light',
  }

  it('logs in with email and returns user + cookies', async () => {
    mockFindUnique.mockResolvedValue(mockUser)
    mockBcryptCompare.mockResolvedValue(true)

    const req = mockReq({ body: { login: 'alice@test.com', password: 'supersecret1234' } })
    const res = mockRes()

    await login(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'alice@test.com' } })
    expect(mockBcryptCompare).toHaveBeenCalledWith('supersecret1234', mockUser.password)
    expect(res.cookie).toHaveBeenCalledWith('access_token', expect.any(String), expect.objectContaining({ httpOnly: true }))
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.objectContaining({ httpOnly: true }))
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'u1', pseudo: 'alice', email: 'alice@test.com', role: 'USER', language: 'fr', theme: 'light' },
    })
  })

  it('logs in with pseudo (falls back from email lookup)', async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)   // email lookup fails
      .mockResolvedValueOnce(mockUser)  // pseudo lookup succeeds
    mockBcryptCompare.mockResolvedValue(true)

    const req = mockReq({ body: { login: 'alice', password: 'supersecret1234' } })
    const res = mockRes()

    await login(req, res)

    expect(mockFindUnique).toHaveBeenNthCalledWith(1, { where: { email: 'alice' } })
    expect(mockFindUnique).toHaveBeenNthCalledWith(2, { where: { pseudo: 'alice' } })
    expect(res.json).toHaveBeenCalled()
  })

  it('throws AuthError when user is not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({ body: { login: 'unknown@test.com', password: 'secret' } })
    const res = mockRes()

    await expect(login(req, res)).rejects.toThrow(AuthError)
    expect(mockBcryptCompare).not.toHaveBeenCalled()
  })

  it('throws AuthError when password is wrong', async () => {
    mockFindUnique.mockResolvedValue(mockUser)
    mockBcryptCompare.mockResolvedValue(false)

    const req = mockReq({ body: { login: 'alice@test.com', password: 'wrongpassword' } })
    const res = mockRes()

    await expect(login(req, res)).rejects.toThrow(AuthError)
  })

  it('throws ValidationError on invalid input (empty body)', async () => {
    const req = mockReq({ body: {} })
    const res = mockRes()

    await expect(login(req, res)).rejects.toThrow(ValidationError)
  })
})
