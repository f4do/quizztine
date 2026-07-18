import { describe, it, expect, vi } from 'vitest'

// Capture the options passed to express-rate-limit
const mockRateLimit = vi.fn().mockReturnValue(() => {})

vi.mock('express-rate-limit', () => ({
  default: mockRateLimit,
}))

// Import after mock
const { authLimiter, globalLimiter } = await import('../rate-limit.js')

describe('authLimiter', () => {
  it('is configured with 10 req / 15 min per IP', () => {
    const callArgs = mockRateLimit.mock.calls[0][0]
    expect(callArgs.windowMs).toBe(15 * 60 * 1000)
    expect(callArgs.max).toBe(10)
    expect(callArgs.standardHeaders).toBe(true)
    expect(callArgs.legacyHeaders).toBe(false)
  })

  it('has structured error response with RATE_LIMIT_EXCEEDED code', () => {
    const callArgs = mockRateLimit.mock.calls[0][0]
    const msg = callArgs.message as Record<string, unknown>
    expect(msg.error).toBe('Too many requests')
    expect(msg.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(msg.status).toBe(429)
    expect(typeof msg.details).toBe('string')
  })

  it('is exported as a function (middleware)', () => {
    expect(typeof authLimiter).toBe('function')
  })
})

describe('globalLimiter', () => {
  it('is configured with 100 req / 15 min per IP', () => {
    const callArgs = mockRateLimit.mock.calls[1][0]
    expect(callArgs.windowMs).toBe(15 * 60 * 1000)
    expect(callArgs.max).toBe(100)
    expect(callArgs.standardHeaders).toBe(true)
    expect(callArgs.legacyHeaders).toBe(false)
  })

  it('has structured error response with RATE_LIMIT_EXCEEDED code', () => {
    const callArgs = mockRateLimit.mock.calls[1][0]
    const msg = callArgs.message as Record<string, unknown>
    expect(msg.error).toBe('Too many requests')
    expect(msg.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(msg.status).toBe(429)
    expect(typeof msg.details).toBe('string')
  })

  it('is exported as a function (middleware)', () => {
    expect(typeof globalLimiter).toBe('function')
  })
})
