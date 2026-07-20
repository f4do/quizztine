import { describe, it, expect, vi, afterEach } from 'vitest'
import { signAccessToken, signRefreshToken, verifyToken, hashToken } from '../jwt.js'

const testPayload = { id: 'test-id', pseudo: 'testuser', email: 'test@test.com', role: 'USER' }

describe('JWT utils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('signs and verifies access token', async () => {
    const token = await signAccessToken(testPayload)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    const decoded = await verifyToken(token)
    expect(decoded.id).toBe('test-id')
    expect(decoded.pseudo).toBe('testuser')
    expect(decoded.email).toBe('test@test.com')
    expect(decoded.role).toBe('USER')
  })

  it('signs and verifies refresh token', async () => {
    const token = await signRefreshToken(testPayload)
    expect(typeof token).toBe('string')

    const decoded = await verifyToken(token)
    expect(decoded.id).toBe('test-id')
  })

  it('rejects expired access token', async () => {
    vi.useFakeTimers()
    const token = await signAccessToken(testPayload)

    // Advance past the 1h expiry
    vi.setSystemTime(Date.now() + 61 * 60 * 1000)

    await expect(verifyToken(token)).rejects.toThrow()
  })

  it('rejects expired refresh token', async () => {
    vi.useFakeTimers()
    const token = await signRefreshToken(testPayload)

    // Advance past the 7d expiry
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000)

    await expect(verifyToken(token)).rejects.toThrow()
  })

  it('throws on invalid token', async () => {
    await expect(verifyToken('invalid-token')).rejects.toThrow()
  })

  it('throws on tampered token', async () => {
    const token = await signAccessToken(testPayload)
    const tampered = token.slice(0, -5) + 'XXXXX'
    await expect(verifyToken(tampered)).rejects.toThrow()
  })
})

describe('hashToken', () => {
  it('produces consistent SHA-256 hex hash', () => {
    const hash1 = hashToken('test-token')
    const hash2 = hashToken('test-token')
    const hash3 = hashToken('different-token')
    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })
})
