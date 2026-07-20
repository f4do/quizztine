import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { vi, type Mock } from 'vitest'

type MockedResponse = Response & {
  status: Mock & ReturnType<typeof vi.fn>
  json: Mock & ReturnType<typeof vi.fn>
  cookie: Mock & ReturnType<typeof vi.fn>
  clearCookie: Mock & ReturnType<typeof vi.fn>
}

export function mockReq(overrides: Partial<Record<string, unknown>> = {}): AuthenticatedRequest {
  return {
    body: {},
    user: undefined,
    params: {},
    query: {},
    cookies: {},
    ...overrides,
  } as unknown as AuthenticatedRequest
}

export function mockRes(): MockedResponse {
  const res: Record<string, unknown> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.cookie = vi.fn().mockReturnValue(res)
  res.clearCookie = vi.fn().mockReturnValue(res)
  return res as unknown as MockedResponse
}
