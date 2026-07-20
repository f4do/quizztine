import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { store } from '../room-store.js'
import type { CreateRoomParams } from '../types.js'

const baseRoom = (overrides?: Partial<CreateRoomParams>): CreateRoomParams => ({
  id: 'test-1',
  questions: [{ id: 1, correct_choices: [0], difficulty: 'easy', question_type: 'MCQ' }],
  mode: 'multi_public',
  timer: 30,
  ...overrides,
})

beforeEach(() => {
  store.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RoomStore', () => {
  /* ── CRUD ──────────────────────────────────────────────────────── */

  it('creates a room and returns it', () => {
    const room = store.create(baseRoom())
    expect(room.id).toBe('test-1')
    expect(room.status).toBe('waiting')
    expect(room.mode).toBe('multi_public')
    expect(room.timer).toBe(30)
    expect(room.questions).toHaveLength(1)
    expect(room.createdAt).toBeGreaterThan(0)
  })

  it('generates a UUID when no id is provided', () => {
    const room = store.create(baseRoom({ id: undefined }))
    expect(room.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('gets a room by ID', () => {
    store.create(baseRoom())
    const room = store.get('test-1')
    expect(room).toBeDefined()
    expect(room!.id).toBe('test-1')
  })

  it('get returns undefined for missing room', () => {
    expect(store.get('nonexistent')).toBeUndefined()
  })

  it('getOrThrow returns the room', () => {
    store.create(baseRoom())
    const room = store.getOrThrow('test-1')
    expect(room.id).toBe('test-1')
  })

  it('getOrThrow throws NotFoundError on missing room', () => {
    expect(() => store.getOrThrow('nonexistent')).toThrow(/not found/i)
  })

  it('update mutates the room via callback', () => {
    store.create(baseRoom())
    store.update('test-1', (r) => {
      r.status = 'playing'
    })
    expect(store.get('test-1')!.status).toBe('playing')
  })

  it('update throws on missing room', () => {
    expect(() => store.update('nonexistent', () => {})).toThrow(/not found/i)
  })

  it('remove deletes a room', () => {
    store.create(baseRoom())
    expect(store.remove('test-1')).toBe(true)
    expect(store.get('test-1')).toBeUndefined()
  })

  it('remove returns false for missing room', () => {
    expect(store.remove('nonexistent')).toBe(false)
  })

  it('clear removes all rooms', () => {
    store.create(baseRoom({ id: 'r1' }))
    store.create(baseRoom({ id: 'r2' }))
    store.clear()
    expect(store.get('r1')).toBeUndefined()
    expect(store.get('r2')).toBeUndefined()
  })

  /* ── addPlayer ─────────────────────────────────────────────────── */

  it('addPlayer adds a player to the room', () => {
    store.create(baseRoom())
    const player = store.addPlayer('test-1', 'p1', 'Alice')
    expect(player.id).toBe('p1')
    expect(player.nickname).toBe('Alice')
    expect(player.score).toBe(0)
    expect(player.streak).toBe(0)
    expect(player.cumulativeTime).toBe(0)
    expect(player.finished).toBe(false)
    expect(player.disconnected).toBe(false)
    expect(store.get('test-1')!.players.size).toBe(1)
  })

  it('addPlayer throws on missing room', () => {
    expect(() => store.addPlayer('nonexistent', 'p1', 'Alice')).toThrow(/not found/i)
  })

  it('activePlayers returns non-disconnected players', () => {
    store.create(baseRoom())
    store.addPlayer('test-1', 'p1', 'Alice')
    store.addPlayer('test-1', 'p2', 'Bob')
    const room = store.get('test-1')!
    room.players.get('p2')!.disconnected = true

    const active = store.activePlayers('test-1')
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('p1')
  })

  it('activePlayers returns empty array for missing room', () => {
    expect(store.activePlayers('nonexistent')).toEqual([])
  })

  /* ── cleanupExpired ────────────────────────────────────────────── */

  it('cleanupExpired removes old finished rooms', () => {
    store.create(baseRoom({ id: 'old' }))
    const room = store.get('old')!
    room.status = 'finished'
    room.createdAt = Date.now() - 200_000 // 200s old

    const removed = store.cleanupExpired(100_000) // 100s threshold
    expect(removed).toBe(1)
    expect(store.get('old')).toBeUndefined()
  })

  it('cleanupExpired keeps recently finished rooms', () => {
    store.create(baseRoom({ id: 'recent' }))
    const room = store.get('recent')!
    room.status = 'finished'
    room.createdAt = Date.now() - 10_000 // 10s old

    const removed = store.cleanupExpired(100_000) // 100s threshold
    expect(removed).toBe(0)
    expect(store.get('recent')).toBeDefined()
  })

  it('cleanupExpired keeps playing rooms even when old', () => {
    store.create(baseRoom({ id: 'active' }))
    const room = store.get('active')!
    room.status = 'playing'
    room.createdAt = Date.now() - 200_000

    const removed = store.cleanupExpired(100_000)
    expect(removed).toBe(0)
    expect(store.get('active')).toBeDefined()
  })

  it('cleanupExpired defaults maxAgeMs to 2 hours', () => {
    const room = store.create(baseRoom({ id: 'default-test' }))
    room.status = 'finished'
    room.createdAt = Date.now() - 3_600_000 // 1 hour ago

    // Default maxAgeMs = 7200000 (2hrs), so 1hr old room is kept
    const removed = store.cleanupExpired()
    expect(removed).toBe(0)
  })

  /* ── cleanupOnShutdown ─────────────────────────────────────────── */

  it('cleanupOnShutdown cancels timers and returns active room IDs', () => {
    const room = store.create(baseRoom({ id: 'playing-room' }))
    room.status = 'playing'
    room.deadlineTimer = setTimeout(() => {}, 1000)
    room.advanceTimer = setTimeout(() => {}, 5000)

    const active = store.cleanupOnShutdown()
    expect(active).toContain('playing-room')
    // Timers cleared on the room
    expect(room.deadlineTimer).toBeNull()
    expect(room.advanceTimer).toBeNull()
    // Rooms cleared from store
    expect(store.get('playing-room')).toBeUndefined()
  })

  it('cleanupOnShutdown clears all rooms', () => {
    store.create(baseRoom({ id: 'r1' }))
    store.create(baseRoom({ id: 'r2' }))
    store.cleanupOnShutdown()
    expect(store.get('r1')).toBeUndefined()
    expect(store.get('r2')).toBeUndefined()
  })

  it('cleanupOnShutdown returns empty array when no playing rooms', () => {
    store.create(baseRoom({ id: 'waiting-room' }))
    const active = store.cleanupOnShutdown()
    expect(active).toEqual([])
  })
})
