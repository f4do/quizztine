import { describe, it, expect } from 'vitest'
import { AppError, AuthError, ForbiddenError, NotFoundError, ValidationError } from '../errors.js'

describe('AppError', () => {
  it('creates error with all fields', () => {
    const err = new AppError(400, 'TEST_ERROR', 'Test message', { key: 'value' })
    expect(err.status).toBe(400)
    expect(err.code).toBe('TEST_ERROR')
    expect(err.message).toBe('Test message')
    expect(err.details).toEqual({ key: 'value' })
  })

  it('creates error without details', () => {
    const err = new AppError(500, 'INTERNAL', 'Oops')
    expect(err.status).toBe(500)
    expect(err.details).toBeUndefined()
  })
})

describe('AuthError', () => {
  it('creates with default message', () => {
    const err = new AuthError()
    expect(err.status).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.message).toBe('Unauthorized')
  })

  it('creates with custom message', () => {
    const err = new AuthError('Custom auth message')
    expect(err.message).toBe('Custom auth message')
  })
})

describe('ForbiddenError', () => {
  it('has correct defaults', () => {
    const err = new ForbiddenError()
    expect(err.status).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
  })
})

describe('NotFoundError', () => {
  it('has correct defaults', () => {
    const err = new NotFoundError('User not found')
    expect(err.status).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('User not found')
  })
})

describe('ValidationError', () => {
  it('has correct defaults', () => {
    const err = new ValidationError()
    expect(err.status).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})
