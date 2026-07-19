import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoom } from '../rooms.js'
import { mockReq, mockRes } from '../../test/utils.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockFindMany, mockCreate, mockRoomDelete, mockGameEngineCreateRoom } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockRoomDelete: vi.fn(),
  mockGameEngineCreateRoom: vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    question: { findMany: mockFindMany },
    room: { create: mockCreate, delete: mockRoomDelete },
    roomPlayer: { upsert: vi.fn() },
  },
}))

vi.mock('../../engine/index.js', () => ({
  gameEngine: { createRoom: mockGameEngineCreateRoom },
}))

const publicQuestions = [
  { id: 1, choices: [{ text: 'A', isCorrect: true }], difficulty: 'EASY' },
  { id: 2, choices: [{ text: 'B', isCorrect: false }], difficulty: 'MEDIUM' },
]
const ownPrivateQuestions = [
  { id: 3, choices: [{ text: 'C', isCorrect: true }], difficulty: 'HARD' },
]
const otherPrivateQuestions = [
  { id: 4, choices: [{ text: 'D', isCorrect: true }], difficulty: 'EASY' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createRoom question filtering', () => {
  it('non-auth solo: public only, includePrivate ignored', async () => {
    mockFindMany.mockResolvedValue(publicQuestions)
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'solo', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({ body: { mode: 'solo', includePrivate: true } })
    const res = mockRes()
    await createRoom(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({ where: { visibility: 'PUBLIC' } })
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('non-auth multiplayer: throws ForbiddenError', async () => {
    const req = mockReq({ body: { mode: 'multi_public' } })
    const res = mockRes()
    await expect(createRoom(req, res)).rejects.toThrow('Authentication required')
  })

  it('USER role: public only, includePrivate ignored', async () => {
    mockFindMany.mockResolvedValue(publicQuestions)
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'solo', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({
      user: { id: 'u1', pseudo: 'bob', email: 'b@t.com', role: 'USER' },
      body: { mode: 'solo', includePrivate: true },
    })
    const res = mockRes()
    await createRoom(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({ where: { visibility: 'PUBLIC' } })
  })

  it('quizmaster with includePrivate=false: public only', async () => {
    mockFindMany.mockResolvedValue(publicQuestions)
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'solo', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({
      user: { id: 'u1', pseudo: 'qm1', email: 'qm@t.com', role: 'QUIZMASTER' },
      body: { mode: 'solo', includePrivate: false },
    })
    const res = mockRes()
    await createRoom(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({ where: { visibility: 'PUBLIC' } })
  })

  it('quizmaster with includePrivate=true: own private + public', async () => {
    mockFindMany.mockResolvedValue([...publicQuestions, ...ownPrivateQuestions])
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'solo', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({
      user: { id: 'u1', pseudo: 'qm1', email: 'qm@t.com', role: 'QUIZMASTER' },
      body: { mode: 'solo', includePrivate: true },
    })
    const res = mockRes()
    await createRoom(req, res)

    const where = mockFindMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', authorId: 'u1' },
    ])
  })

  it('quizadmin with includePrivate=true: own private + public (same as quizmaster)', async () => {
    mockFindMany.mockResolvedValue([...publicQuestions, ...ownPrivateQuestions])
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'solo', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({
      user: { id: 'u1', pseudo: 'admin', email: 'a@t.com', role: 'QUIZADMIN' },
      body: { mode: 'solo', includePrivate: true },
    })
    const res = mockRes()
    await createRoom(req, res)

    const where = mockFindMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', authorId: 'u1' },
    ])
  })
})

describe('createRoom response shape', () => {
  it('solo room: no inviteLink', async () => {
    mockFindMany.mockResolvedValue(publicQuestions)
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'solo', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({ body: { mode: 'solo' } })
    const res = mockRes()
    await createRoom(req, res)

    const sent = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sent.room.id).toBe('r1')
    expect(sent.inviteLink).toBeUndefined()
  })

  it('multiplayer room: includes inviteLink', async () => {
    mockFindMany.mockResolvedValue(publicQuestions)
    mockCreate.mockResolvedValue({ id: 'r1', code: 'ABC123', mode: 'multi_public', timer: 30 })
    mockGameEngineCreateRoom.mockResolvedValue({ id: 'r1' })

    const req = mockReq({
      user: { id: 'u1', pseudo: 'bob', email: 'b@t.com', role: 'USER' },
      body: { mode: 'multi_public' },
    })
    const res = mockRes()
    await createRoom(req, res)

    const sent = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sent.inviteLink).toBe('/room/r1')
  })
})
