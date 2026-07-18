import { describe, it, expect } from 'vitest'
import { signAccessToken, signRefreshToken, verifyToken, hashToken } from '../jwt.js'

const testPayload = { id: 'test-id', pseudo: 'testuser', email: 'test@test.com', role: 'USER' }

describe('JWT utils', () => {
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
