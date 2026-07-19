/* ------------------------------------------------------------------ */
/*  Engine module barrel export + gameEngine facade                    */
/*                                                                     */
/*  The `gameEngine` object replaces the old EngineClient HTTP class,  */
/*  providing the same method signatures so that controllers need      */
/*  minimal changes (only the import path).                            */
/* ------------------------------------------------------------------ */

export { store } from './room-store.js'
export { flow, ClassicFlow, GameFlow, shuffleQuestions, FEEDBACK_DELAY_MS } from './game-flow.js'
export { calculateScore, isAnswerCorrect } from './scoring.js'
export { validateAnswer, MCQValidator, getValidator, VALIDATORS } from './answer-validator.js'
export { notifyBackend } from './notifications.js'
export * from './types.js'

import { store } from './room-store.js'
import { flow } from './game-flow.js'
import { isAnswerCorrect, calculateScore } from './scoring.js'
import logger from '../lib/logger.js'
import { AppError } from '../types/errors.js'
import type {
  Room,
  Player,
  RoomMode,
  Difficulty,
  QuestionType,
  QuestionPayload,
  CreateRoomParams,
  JoinPayload,
  AnswerPayload,
  ReplayPayload,
  CreateRoomResponse,
  JoinRoomResponse,
  RoomResponse,
  CurrentQuestionResponse,
  AnswerResponse,
  ScoreboardEntry,
} from './types.js'

/* ------------------------------------------------------------------ */
/*  Helpers (internal)                                                 */
/* ------------------------------------------------------------------ */

function activePlayers(room: Room): Player[] {
  return [...room.players.values()].filter(p => !p.disconnected)
}

function activePlayersCount(room: Room): number {
  return activePlayers(room).length
}

function getCurrentQid(room: Room): number | null {
  if (room.currentQuestionIndex < 0 || room.currentQuestionIndex >= room.shuffledQuestionIds.length) {
    return null
  }
  return room.shuffledQuestionIds[room.currentQuestionIndex]
}

/* ------------------------------------------------------------------ */
/*  Facade — drop-in replacement for engine-client.ts                  */
/* ------------------------------------------------------------------ */

export const gameEngine = {
  /* ── Room lifecycle ────────────────────────────────────────────── */

  async createRoom(data: CreateRoomParams): Promise<CreateRoomResponse> {
    const room = store.create(data)

    // Solo rooms are NOT auto-started here — the frontend player joins first,
    // then handleSoloStart calls startGame.  This avoids the "Game already
    // started" error when joinRoom checks status !== 'waiting'.

    logger.info(
      { event: 'room-created', roomId: room.id, mode: room.mode, questions: room.questions.length },
      'Room created in engine',
    )

    return {
      id: room.id,
      mode: room.mode,
      timer: room.timer,
      question_count: room.questions.length,
    }
  },

  async joinRoom(roomId: string, data: JoinPayload): Promise<JoinRoomResponse> {
    const room = store.getOrThrow(roomId)

    if (room.status === 'finished') {
      throw new AppError(400, 'ROOM_NOT_JOINABLE', 'Game already finished')
    }

    // Check nickname uniqueness
    const existingNick = [...room.players.values()].find(p => p.nickname === data.nickname)
    if (existingNick && existingNick.id !== data.player_id) {
      // A disconnected player with the same nickname can reconnect
      if (room.status === 'playing' && existingNick.disconnected) {
        store.update(roomId, (r) => {
          const p = r.players.get(existingNick.id)
          if (p) p.disconnected = false
        })
        logger.info(
          { event: 'player-reconnected-by-nick', roomId, nickname: data.nickname },
          'Player reconnected by nickname',
        )
        return { room_id: roomId, player_id: existingNick.id, nickname: existingNick.nickname }
      }
      throw new AppError(409, 'NICKNAME_TAKEN', `Nickname ${data.nickname} already in room`)
    }

    // Player reconnecting (finished already checked above)
    if (room.players.has(data.player_id)) {
      store.update(roomId, (r) => {
        const p = r.players.get(data.player_id)
        if (p) p.disconnected = false
      })
      logger.info(
        { event: 'player-reconnected', roomId, playerId: data.player_id },
        'Player reconnected',
      )
      return { room_id: roomId, player_id: data.player_id, nickname: room.players.get(data.player_id)!.nickname }
    }

    if (room.status !== 'waiting') {
      throw new AppError(400, 'ROOM_NOT_JOINABLE', 'Game already started')
    }

    const player = store.addPlayer(roomId, data.player_id, data.nickname)

    logger.info(
      { event: 'player-joined', roomId, playerId: data.player_id },
      'Player joined room',
    )

    return { room_id: roomId, player_id: player.id, nickname: player.nickname }
  },

  async startGame(roomId: string, playerId: string | null): Promise<void> {
    const room = store.getOrThrow(roomId)

    if (room.status !== 'waiting') {
      throw new AppError(400, 'ALREADY_STARTED', 'Game already started or finished')
    }

    // Creator check (skip if no creatorPlayerId, e.g. solo)
    if (room.creatorPlayerId && playerId !== room.creatorPlayerId) {
      throw new AppError(403, 'NOT_CREATOR', 'Only the room creator can start the game')
    }

    if (room.players.size === 0) {
      throw new AppError(400, 'NO_PLAYERS', 'Cannot start a room with no players')
    }

    if (room.mode !== 'solo' && room.players.size < 2) {
      throw new AppError(400, 'NOT_ENOUGH_PLAYERS', 'Multiplayer rooms need at least 2 players')
    }

    flow.startGame(roomId, playerId)
    logger.info({ event: 'room-started', roomId, players: room.players.size }, 'Room started')
  },

  async removePlayer(roomId: string, playerId: string): Promise<void> {
    const room = store.get(roomId)
    if (!room) {
      // Silently ignore if room doesn't exist (fire-and-forget callers)
      return
    }

    if (!room.players.has(playerId)) {
      // Silently ignore if player not in room
      return
    }

    if (room.status === 'waiting') {
      const playerCount = room.players.size
      store.update(roomId, (r) => {
        r.players.delete(playerId)
      })
      logger.info(
        { event: 'player-removed', roomId, playerId },
        'Player removed from waiting room',
      )

      // If room is empty and creator is the one leaving, delete the room
      if (playerCount <= 1) {
        const currentRoom = store.get(roomId)
        if (currentRoom && (!currentRoom.creatorPlayerId || playerId === currentRoom.creatorPlayerId)) {
          this.cleanupRoom(roomId)
          logger.info({ event: 'room-deleted-empty', roomId }, 'Empty room deleted')
        }
      }
    } else {
      store.update(roomId, (r) => {
        const p = r.players.get(playerId)
        if (p) p.disconnected = true
      })
      logger.info(
        { event: 'player-disconnected', roomId, playerId },
        'Player marked disconnected',
      )
      await flow.onRemovePlayer(roomId)
    }
  },

  /** Internal: clean up a room (cancel timers, remove from store). */
  cleanupRoom(roomId: string): void {
    const room = store.get(roomId)
    if (room) {
      if (room.advanceTimer) clearTimeout(room.advanceTimer)
      if (room.deadlineTimer) clearTimeout(room.deadlineTimer)
    }
    store.remove(roomId)
  },

  /* ── Game flow ─────────────────────────────────────────────────── */

  async submitAnswer(
    roomId: string,
    playerId: string,
    data: AnswerPayload,
  ): Promise<AnswerResponse> {
    const room = store.getOrThrow(roomId)

    if (room.status !== 'playing') {
      throw new AppError(400, 'GAME_NOT_PLAYING', 'Game is not in progress')
    }

    const player = room.players.get(playerId)
    if (!player) {
      throw new AppError(404, 'PLAYER_NOT_FOUND', `Player ${playerId} not in room`)
    }

    // ── Race condition: deadline timer already finished the round ──
    if (room.feedbackUntil !== null) {
      // If the player already answered we return a timeout result
      if (room.answeredPlayers.has(playerId)) {
        return {
          correct: false,
          points: 0,
          bonus: 0,
          streak: 0,
          cumulative_time: player.cumulativeTime,
        }
      }
      // Rare: player hasn't been registered yet — register as timeout
      room.answeredPlayers.add(playerId)
      room.currentRoundAnswers.set(playerId, {
        questionId: data.question_id,
        selectedChoices: data.selected_choices,
        elapsed: room.timer,
        timeout: true,
      })
      return {
        correct: false,
        points: 0,
        bonus: 0,
        streak: 0,
        cumulative_time: room.timer,
      }
    }

    if (player.finished) {
      throw new AppError(400, 'PLAYER_FINISHED', 'Player already answered all questions')
    }

    const currentQid = getCurrentQid(room)
    if (currentQid === null) {
      throw new AppError(400, 'GAME_NOT_PLAYING', 'No current question')
    }

    if (data.question_id !== currentQid) {
      throw new AppError(400, 'WRONG_QUESTION', 'Answer does not match the current question')
    }

    if (room.answeredPlayers.has(playerId)) {
      throw new AppError(400, 'ALREADY_ANSWERED', 'Player already answered this round')
    }

    // Compute elapsed based on when the question started
    // The server calculates elapsed using its own clock.
    // We use the time the player took based on timer comparison.
    // In the Python version, `elapsed = time.time() - room.question_started_at`
    // but we don't store question_started_at in TS Room. Instead we approximate:
    // elapsed = min(room.timer, time since start)
    // Since we don't have question_started_at in TS, we can estimate remaining
    // from the deadline timer, or simply use client_timestamp as a heuristic.
    // For simplicity, use client_timestamp difference:
    const clientElapsed = (Date.now() - data.client_timestamp) / 1000
    const elapsed = Math.min(clientElapsed, room.timer)
    const timeout = elapsed >= room.timer

    // Register the answer
    room.answeredPlayers.add(playerId)
    room.currentRoundAnswers.set(playerId, {
      questionId: data.question_id,
      selectedChoices: data.selected_choices,
      elapsed,
      timeout,
    })

    // Provisional scoring for the response
    const qstate = room.questions.find(q => q.id === currentQid)
    let responseCorrect = false
    let responsePoints = 0
    let responseBonus = 0
    let responseStreak = 0

    if (!timeout && qstate) {
      responseCorrect = isAnswerCorrect(
        qstate.correctChoices,
        data.selected_choices,
        qstate.questionType,
      )
      const ctx = {
        mode: room.mode,
        playerCount: activePlayersCount(room),
        difficulty: qstate.difficulty as Difficulty,
        isCorrect: responseCorrect,
        currentStreak: player.streak,
        firstCorrect: false, // Not known yet during provisional scoring
        aloneCorrect: false,
      }
      const sr = calculateScore(ctx)
      responsePoints = sr.total
      responseBonus = sr.bonus
      responseStreak = responseCorrect ? sr.newStreak : 0
    }

    logger.info(
      { event: 'answer-recorded', roomId, playerId, questionId: data.question_id, timeout },
      'Answer recorded',
    )

    // Check if all active players have answered -> finish round
    const allAnswered = activePlayers(room).every(p => room.answeredPlayers.has(p.id))
    if (allAnswered) {
      // Defer to next tick to let the response return first, then finish
      // (matching the Python pattern where the response is sent before finishRound)
      setImmediate(() => {
        flow.onAnswer(roomId).catch(err => {
          logger.error({ err, roomId }, 'onAnswer after all answered failed')
        })
      })
    }

    const responseTime = !timeout ? elapsed : room.timer
    return {
      correct: responseCorrect,
      points: responsePoints,
      bonus: responseBonus,
      streak: responseStreak,
      cumulative_time: player.cumulativeTime + responseTime,
    }
  },

  /* ── Queries ────────────────────────────────────────────────────── */

  async getRoom(roomId: string): Promise<RoomResponse> {
    const room = store.getOrThrow(roomId)

    return {
      id: room.id,
      code: room.code,
      mode: room.mode,
      timer: room.timer,
      status: room.status,
      player_count: room.players.size,
      current_question_index: room.currentQuestionIndex,
      total_questions: room.shuffledQuestionIds.length || room.questions.length,
      players: [...room.players.values()].map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        cumulative_time: p.cumulativeTime,
        finished: p.finished,
        disconnected: p.disconnected,
        answered: room.answeredPlayers.has(p.id),
      })),
    }
  },

  async getCurrentQuestion(
    roomId: string,
    playerId: string,
  ): Promise<CurrentQuestionResponse> {
    const room = store.getOrThrow(roomId)

    if (room.status !== 'playing') {
      throw new AppError(400, 'GAME_NOT_PLAYING', 'Game is not in progress')
    }

    const player = room.players.get(playerId)
    if (!player) {
      throw new AppError(404, 'PLAYER_NOT_FOUND', `Player ${playerId} not in room`)
    }

    if (player.finished) {
      throw new AppError(400, 'PLAYER_FINISHED', 'Player has already answered all questions')
    }

    const qid = getCurrentQid(room)
    if (qid === null) {
      throw new AppError(400, 'PLAYER_FINISHED', 'Player has already answered all questions')
    }

    return { question_id: qid, index: room.currentQuestionIndex }
  },

  async getScoreboard(roomId: string): Promise<ScoreboardEntry[]> {
    const room = store.getOrThrow(roomId)

    const sortedPlayers = [...room.players.values()].sort(
      (a, b) => b.score - a.score || a.cumulativeTime - b.cumulativeTime,
    )

    return sortedPlayers.map(p => ({
      player_id: p.id,
      nickname: p.nickname,
      score: p.score,
      streak: p.streak,
      cumulative_time: p.cumulativeTime,
    }))
  },

  async replayRoom(
    roomId: string,
    data?: ReplayPayload,
  ): Promise<{ status: string }> {
    const room = store.getOrThrow(roomId)

    if (room.status !== 'finished') {
      throw new AppError(400, 'NOT_FINISHED', `Room ${roomId} is not finished (status=${room.status})`)
    }

    store.update(roomId, (r) => {
      // Replace questions if provided
      if (data?.questions) {
        r.questions = data.questions.map(q => ({
          id: q.id,
          correctChoices: q.correct_choices,
          difficulty: q.difficulty as Difficulty,
          questionType: (q.question_type as QuestionType) ?? 'MCQ',
        }))
      }

      // Reset all state
      r.status = 'waiting'
      r.answers = []
      r.shuffledQuestionIds = []
      r.currentQuestionIndex = 0
      r.answeredPlayers.clear()
      r.currentRoundAnswers.clear()
      r.feedbackUntil = null

      // Cancel timers
      if (r.advanceTimer) { clearTimeout(r.advanceTimer); r.advanceTimer = null }
      if (r.deadlineTimer) { clearTimeout(r.deadlineTimer); r.deadlineTimer = null }

      // Reset player stats
      for (const p of r.players.values()) {
        p.score = 0
        p.streak = 0
        p.cumulativeTime = 0
        p.finished = false
        p.disconnected = false
      }
    })

    logger.info({ event: 'room-replayed', roomId }, 'Room replayed')

    return { status: 'replayed' }
  },
}
