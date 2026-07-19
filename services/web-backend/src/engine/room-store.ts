import crypto from 'crypto'
import type { Room, Player, CreateRoomParams } from './types.js'
import type { Difficulty, QuestionType } from './types.js'
import { NotFoundError } from '../types/errors.js'
import logger from '../lib/logger.js'

/**
 * In-memory room store.
 *
 * - `get()` returns a direct reference (mutable).  Mutations MUST go through
 *   `update()` to keep the codebase consistent and to make future migration
 *   to a lock-free ordering scheme easier.
 * - No deep-copy, no concurrency locks (single-threaded event loop).
 */
export class RoomStore {
  private rooms = new Map<string, Room>()

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                               */
  /* ------------------------------------------------------------------ */

  create(params: CreateRoomParams): Room {
    const now = Date.now()
    const room: Room = {
      id: params.id ?? crypto.randomUUID(),
      code: params.code ?? '',
      mode: params.mode,
      timer: params.timer,
      status: 'waiting',
      questions: params.questions.map(q => ({
        id: q.id,
        correctChoices: q.correct_choices,
        difficulty: q.difficulty as Difficulty,
        questionType: (q.question_type as QuestionType) ?? 'MCQ',
      })),
      shuffledQuestionIds: [],
      players: new Map(),
      answers: [],
      currentQuestionIndex: 0,
      answeredPlayers: new Set(),
      currentRoundAnswers: new Map(),
      feedbackUntil: null,
      deadlineTimer: null,
      advanceTimer: null,
      totalQuestions: params.questions.length,
      creatorPlayerId: params.creator_player_id ?? null,
      createdAt: now,
    }
    this.rooms.set(room.id, room)
    return room
  }

  /** Return the direct room reference (mutable). */
  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  /** Like get() but throws NotFoundError when missing. */
  getOrThrow(roomId: string): Room {
    const room = this.rooms.get(roomId)
    if (!room) throw new NotFoundError(`Room ${roomId} not found`)
    return room
  }

  /**
   * Atomically read + mutate a room.  Returns the room reference after
   * the callback has run.  Throws NotFoundError when the room is missing.
   */
  update(roomId: string, updater: (room: Room) => void): Room {
    const room = this.rooms.get(roomId)
    if (!room) throw new NotFoundError(`Room ${roomId} not found`)
    updater(room)
    return room
  }

  remove(roomId: string): boolean {
    return this.rooms.delete(roomId)
  }

  clear(): void {
    this.rooms.clear()
  }

  /* ------------------------------------------------------------------ */
  /*  Player helpers                                                     */
  /* ------------------------------------------------------------------ */

  addPlayer(roomId: string, playerId: string, nickname: string): Player {
    const room = this.getOrThrow(roomId)
    const player: Player = {
      id: playerId,
      nickname,
      score: 0,
      streak: 0,
      cumulativeTime: 0,
      finished: false,
      disconnected: false,
    }
    room.players.set(playerId, player)
    return player
  }

  /** Convenience: list of non-disconnected players. */
  activePlayers(roomId: string): Player[] {
    const room = this.rooms.get(roomId)
    if (!room) return []
    return [...room.players.values()].filter(p => !p.disconnected)
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /** Remove finished rooms older than maxAgeMs (default 2 hours). */
  cleanupExpired(maxAgeMs: number = 7_200_000): number {
    const now = Date.now()
    let count = 0
    for (const [id, room] of this.rooms) {
      if (room.status === 'finished' && (now - room.createdAt) > maxAgeMs) {
        this.cancelTimers(room)
        this.rooms.delete(id)
        count++
      }
    }
    if (count > 0) {
      logger.info({ event: 'cleanup-expired', count, maxAgeMs }, 'Cleaned up expired rooms')
    }
    return count
  }

  /** Cancel all timers and return IDs of rooms that were playing. */
  cleanupOnShutdown(): string[] {
    const active: string[] = []
    for (const [id, room] of this.rooms) {
      this.cancelTimers(room)
      if (room.status === 'playing') active.push(id)
    }
    if (active.length > 0) {
      logger.info({ event: 'shutdown-cancel-timers', rooms: active }, 'Cancelled room timers on shutdown')
    }
    this.rooms.clear()
    return active
  }

  private cancelTimers(room: Room): void {
    if (room.advanceTimer) { clearTimeout(room.advanceTimer); room.advanceTimer = null }
    if (room.deadlineTimer) { clearTimeout(room.deadlineTimer); room.deadlineTimer = null }
  }
}

/** Singleton store instance. */
export const store = new RoomStore()
