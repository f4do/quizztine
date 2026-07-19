import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { engineClient } from '../engine-client.js'
import { AppError } from '../../types/errors.js'

describe('EngineClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockSuccessResponse(data: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    })
  }

  function mockErrorResponse(status: number, errorData?: Record<string, unknown>) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: () => Promise.resolve(errorData ?? { error: 'Engine error' }),
    })
  }

  describe('createRoom', () => {
    it('sends correct payload with all fields', async () => {
      mockSuccessResponse({ id: 'room-1', mode: 'solo', timer: 30, question_count: 5 })
      await engineClient.createRoom({
        id: 'room-1',
        questions: [{ id: 1, correct_choices: [0], difficulty: 'easy', question_type: 'MCQ' }],
        mode: 'solo',
        timer: 30,
        code: 'ABC123',
        creator_player_id: 'creator-1',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/rooms')
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('application/json')
      expect(opts.signal).toBeInstanceOf(AbortSignal)
      const body = JSON.parse(opts.body)
      expect(body.id).toBe('room-1')
      expect(body.questions[0].id).toBe(1)
      expect(body.questions[0].correct_choices).toEqual([0])
      expect(body.questions[0].difficulty).toBe('easy')
      expect(body.questions[0].question_type).toBe('MCQ')
      expect(body.mode).toBe('solo')
      expect(body.timer).toBe(30)
      expect(body.code).toBe('ABC123')
      expect(body.creator_player_id).toBe('creator-1')
    })

    it('omits optional id/code/creator_player_id when not provided', async () => {
      mockSuccessResponse({ id: 'room-2', mode: 'multi_public', timer: 20, question_count: 10 })
      await engineClient.createRoom({
        questions: [{ id: 2, correct_choices: [], difficulty: 'medium', question_type: 'MCQ' }],
        mode: 'multi_public',
        timer: 20,
      })
      const [, opts] = mockFetch.mock.calls[0]
      const body = JSON.parse(opts.body)
      expect(body.id).toBeUndefined()
      expect(body.code).toBeUndefined()
      expect(body.creator_player_id).toBeUndefined()
    })

    it('returns CreateRoomResponse on success', async () => {
      const expected = { id: 'room-1', mode: 'solo', timer: 30, question_count: 5 }
      mockSuccessResponse(expected)
      const result = await engineClient.createRoom({
        questions: [],
        mode: 'solo',
        timer: 30,
      })
      expect(result).toEqual(expected)
    })

    it('throws AppError on failure with JSON error body', async () => {
      mockErrorResponse(503, { error: 'Engine overloaded' })
      await expect(
        engineClient.createRoom({ questions: [], mode: 'solo', timer: 30 }),
      ).rejects.toThrow(AppError)
    })

    it('throws AppError on failure without JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('No JSON')),
      })
      await expect(
        engineClient.createRoom({ questions: [], mode: 'solo', timer: 30 }),
      ).rejects.toThrow(AppError)
    })
  })

  describe('removePlayer', () => {
    it('calls DELETE on the correct endpoint', async () => {
      mockSuccessResponse(null)
      await engineClient.removePlayer('room-1', 'player-1')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/rooms/room-1/players/player-1')
      expect(opts.method).toBe('DELETE')
    })

    it('throws AppError on failure', async () => {
      mockErrorResponse(500)
      await expect(engineClient.removePlayer('room-1', 'player-1')).rejects.toThrow(AppError)
    })

    it('throws AppError on failure without JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('No JSON')),
      })
      await expect(engineClient.removePlayer('room-1', 'player-1')).rejects.toThrow(AppError)
    })
  })

  describe('joinRoom', () => {
    it('calls POST on the correct endpoint with player_id and nickname', async () => {
      mockSuccessResponse({ room_id: 'room-1', player_id: 'player-1', nickname: 'Alice' })
      await engineClient.joinRoom('room-1', { player_id: 'player-1', nickname: 'Alice' })
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/rooms/room-1/join')
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('application/json')
      const body = JSON.parse(opts.body)
      expect(body.player_id).toBe('player-1')
      expect(body.nickname).toBe('Alice')
    })

    it('throws AppError on failure', async () => {
      mockErrorResponse(409, { error: 'NICKNAME_TAKEN' })
      await expect(
        engineClient.joinRoom('room-1', { player_id: 'player-1', nickname: 'Alice' }),
      ).rejects.toThrow(AppError)
    })

    it('throws AppError on failure without JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('No JSON')),
      })
      await expect(
        engineClient.joinRoom('room-1', { player_id: 'player-1', nickname: 'Alice' }),
      ).rejects.toThrow(AppError)
    })
  })

  describe('submitAnswer', () => {
    it('calls POST on the correct endpoint with answer data', async () => {
      mockSuccessResponse({ correct: true, points: 10, bonus: 0, streak: 1, cumulative_time: 5.2 })
      await engineClient.submitAnswer('room-1', 'player-1', {
        question_id: 42,
        selected_choices: [0, 2],
        client_timestamp: 1234567890,
      })
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/rooms/room-1/answer/player-1')
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('application/json')
      const body = JSON.parse(opts.body)
      expect(body.question_id).toBe(42)
      expect(body.selected_choices).toEqual([0, 2])
      expect(body.client_timestamp).toBe(1234567890)
    })

    it('returns AnswerResponse on success', async () => {
      const expected = { correct: true, points: 15, bonus: 5, streak: 2, cumulative_time: 8.1 }
      mockSuccessResponse(expected)
      const result = await engineClient.submitAnswer('room-1', 'player-1', {
        question_id: 42,
        selected_choices: [0],
        client_timestamp: 1234567890,
      })
      expect(result).toEqual(expected)
    })

    it('throws AppError on failure', async () => {
      mockErrorResponse(500)
      await expect(
        engineClient.submitAnswer('room-1', 'player-1', {
          question_id: 42,
          selected_choices: [0],
          client_timestamp: 1234567890,
        }),
      ).rejects.toThrow(AppError)
    })

    it('throws AppError on failure without JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('No JSON')),
      })
      await expect(
        engineClient.submitAnswer('room-1', 'player-1', {
          question_id: 42,
          selected_choices: [0],
          client_timestamp: 1234567890,
        }),
      ).rejects.toThrow(AppError)
    })
  })

  describe('getScoreboard', () => {
    it('calls GET on the correct endpoint', async () => {
      mockSuccessResponse([])
      await engineClient.getScoreboard('room-1')
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/rooms/room-1/scoreboard')
      // GET is the default fetch method, so opts.method may be undefined
      expect(opts.method === undefined || opts.method === 'GET').toBe(true)
    })

    it('returns ScoreboardEntry[] on success', async () => {
      const expected = [
        { player_id: 'p1', nickname: 'Alice', score: 100, streak: 3, cumulative_time: 15.0 },
        { player_id: 'p2', nickname: 'Bob', score: 80, streak: 1, cumulative_time: 12.5 },
      ]
      mockSuccessResponse(expected)
      const result = await engineClient.getScoreboard('room-1')
      expect(result).toEqual(expected)
    })

    it('throws AppError on failure', async () => {
      mockErrorResponse(500)
      await expect(engineClient.getScoreboard('room-1')).rejects.toThrow(AppError)
    })

    it('throws AppError on failure without JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('No JSON')),
      })
      await expect(engineClient.getScoreboard('room-1')).rejects.toThrow(AppError)
    })
  })
})
