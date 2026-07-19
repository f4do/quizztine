/* ------------------------------------------------------------------ */
/*  Game flow — round lifecycle, scoring, timer management             */
/*  Port of game_flow.py                                               */
/* ------------------------------------------------------------------ */

import type { Room, Player, Difficulty } from './types.js'
import type { AnswerRecord } from './types.js'
import { store } from './room-store.js'
import { calculateScore, isAnswerCorrect } from './scoring.js'
import { notifyBackend } from './notifications.js'
import logger from '../lib/logger.js'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Duration in ms the feedback screen is shown before advancing. */
export const FEEDBACK_DELAY_MS = 5_000

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function activePlayers(room: Room): Player[] {
  return [...room.players.values()].filter(p => !p.disconnected)
}

function activePlayersCount(room: Room): number {
  return activePlayers(room).length
}

/* ------------------------------------------------------------------ */
/*  Shuffle (Fisher–Yates)                                             */
/* ------------------------------------------------------------------ */

export function shuffleQuestions(room: Room): void {
  const ids = room.questions.map(q => q.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  room.shuffledQuestionIds = ids
}

/* ------------------------------------------------------------------ */
/*  Abstract GameFlow                                                  */
/* ------------------------------------------------------------------ */

export abstract class GameFlow {
  /* ── Hooks ─────────────────────────────────────────────────────── */

  abstract shouldFinishRound(room: Room): boolean

  abstract shouldEliminate(player: Player): boolean

  /* ── Callbacks ──────────────────────────────────────────────────── */

  async onAnswer(roomId: string): Promise<void> {
    const room = store.get(roomId)
    if (!room) return
    if (this.shouldFinishRound(room)) {
      await this.finishRound(roomId)
    }
  }

  async onRemovePlayer(roomId: string): Promise<void> {
    const room = store.get(roomId)
    if (!room) return
    if (
      room.status === 'playing' &&
      room.feedbackUntil === null &&
      this.shouldFinishRound(room)
    ) {
      await this.finishRound(roomId)
    }
  }

  /* ── Round lifecycle ───────────────────────────────────────────── */

  /**
   * Starts the game for a room: shuffles questions, sets status,
   * initialises round state, starts the deadline timer.
   *
   * Called from the facade's startGame() and auto-start for solo.
   */
  startGame(roomId: string, _playerId: string | null): void {
    const room = store.getOrThrow(roomId)

    shuffleQuestions(room)
    room.status = 'playing'
    room.currentQuestionIndex = 0
    room.answeredPlayers.clear()
    room.currentRoundAnswers.clear()
    room.feedbackUntil = null

    this.scheduleDeadline(roomId)
  }

  /**
   * Called when the round timer expires (deadline) or when all
   * active players have answered.
   */
  async finishRound(roomId: string): Promise<void> {
    const room = store.get(roomId)
    if (!room || room.status !== 'playing') return

    // Guard: prevent double-finish (race: deadline timer + all answered)
    if (room.feedbackUntil !== null) return

    // Cancel the deadline timer
    if (room.deadlineTimer) {
      clearTimeout(room.deadlineTimer)
      room.deadlineTimer = null
    }

    // Fill unanswered players as timeout
    for (const player of activePlayers(room)) {
      if (!room.currentRoundAnswers.has(player.id)) {
        room.currentRoundAnswers.set(player.id, {
          questionId: room.shuffledQuestionIds[room.currentQuestionIndex] ?? 0,
          selectedChoices: [],
          elapsed: room.timer,
          timeout: true,
        })
        room.answeredPlayers.add(player.id)
      }
    }

    // Score round
    const results = this.scoreRound(room)

    const currentQid = room.shuffledQuestionIds[room.currentQuestionIndex] ?? null
    const qstate = currentQid !== null
      ? room.questions.find(q => q.id === currentQid) ?? null
      : null
    const correctChoices = qstate ? qstate.correctChoices : []

    room.feedbackUntil = Date.now() + FEEDBACK_DELAY_MS

    // Notify backend
    await notifyBackend(roomId, 'question-finished', {
      question_id: currentQid,
      correct_choices: correctChoices,
      results,
    })

    logger.info(
      { event: 'round-finished', roomId, questionId: currentQid, resultCount: results.length },
      'Round finished',
    )

    // Schedule advance after feedback
    this.scheduleAdvance(roomId)
  }

  /**
   * Moves to the next question.  If there are no more questions the
   * game is ended and results are sent.
   */
  async advanceQuestion(roomId: string): Promise<void> {
    const room = store.get(roomId)
    if (!room || room.status !== 'playing') return

    room.currentQuestionIndex++

    // Clear round state
    room.answeredPlayers.clear()
    room.currentRoundAnswers.clear()
    room.feedbackUntil = null

    if (room.advanceTimer) {
      clearTimeout(room.advanceTimer)
      room.advanceTimer = null
    }

    // Check if game is over
    if (room.currentQuestionIndex >= room.shuffledQuestionIds.length) {
      for (const player of room.players.values()) {
        player.finished = true
      }
      room.status = 'finished'

      await this.sendResults(roomId)
      await notifyBackend(roomId, 'game-finished', {})

      logger.info({ event: 'game-finished', roomId }, 'Game finished')
      return
    }

    // Start the next round
    this.scheduleDeadline(roomId)

    await notifyBackend(roomId, 'next-question', {
      question_index: room.currentQuestionIndex,
    })

    logger.info(
      { event: 'next-question', roomId, index: room.currentQuestionIndex },
      'Advancing to next question',
    )
  }

  /* ── Timer management ──────────────────────────────────────────── */

  private scheduleDeadline(roomId: string): void {
    const room = store.get(roomId)
    if (!room) return

    // Clear any existing deadline timer first
    if (room.deadlineTimer) {
      clearTimeout(room.deadlineTimer)
    }

    room.deadlineTimer = setTimeout(() => {
      this.finishRound(roomId).catch(err => {
        logger.error({ err, roomId }, 'Deadline finishRound failed')
      })
    }, room.timer * 1000)
  }

  private scheduleAdvance(roomId: string): void {
    const room = store.get(roomId)
    if (!room) return

    // Clear any existing advance timer first
    if (room.advanceTimer) {
      clearTimeout(room.advanceTimer)
    }

    room.advanceTimer = setTimeout(() => {
      this.advanceQuestion(roomId).catch(err => {
        logger.error({ err, roomId }, 'Advance question failed')
      })
    }, FEEDBACK_DELAY_MS)
  }

  /* ── Scoring helpers ───────────────────────────────────────────── */

  /**
   * Score a completed round.  Mutates player stats on the room.
   * Returns the result entries to send via the 'question-finished'
   * notification.
   */
  protected scoreRound(room: Room): Array<{
    player_id: string
    nickname: string
    correct: boolean
    points: number
    bonus: number
    streak: number
    cumulative_time: number
  }> {
    const currentQid = room.shuffledQuestionIds[room.currentQuestionIndex]
    const qstate = room.questions.find(q => q.id === currentQid)
    if (!qstate) return []

    // Determine which players answered correctly (within time)
    const correctPlayers = new Set<string>()
    for (const [pid, ra] of room.currentRoundAnswers) {
      if (!ra.timeout && isAnswerCorrect(qstate.correctChoices, ra.selectedChoices, qstate.questionType)) {
        correctPlayers.add(pid)
      }
    }

    // Sort answers by elapsed time (fastest first)
    const sortedEntries = [...room.currentRoundAnswers.entries()].sort(
      (a, b) => a[1].elapsed - b[1].elapsed,
    )

    const results: Array<{
      player_id: string
      nickname: string
      correct: boolean
      points: number
      bonus: number
      streak: number
      cumulative_time: number
    }> = []

    for (const [pid, ra] of sortedEntries) {
      const player = room.players.get(pid)
      if (!player) continue

      const oldStreak = player.streak

      let correct: boolean
      let points: number
      let bonus: number
      let newStreak: number
      let timeSpent: number

      if (ra.timeout) {
        correct = false
        points = 0
        bonus = 0
        newStreak = 0
        player.streak = 0
        timeSpent = room.timer
      } else {
        correct = isAnswerCorrect(
          qstate.correctChoices,
          ra.selectedChoices,
          qstate.questionType,
        )
        timeSpent = Math.min(ra.elapsed, room.timer)

        if (correct) {
          const firstCorrect = pid === [...correctPlayers][0]
          const aloneCorrect = correctPlayers.size === 1
          const ctx = {
            mode: room.mode,
            playerCount: activePlayersCount(room),
            difficulty: qstate.difficulty as Difficulty,
            isCorrect: true,
            currentStreak: oldStreak,
            firstCorrect,
            aloneCorrect,
          }
          const sr = calculateScore(ctx)
          points = sr.total
          bonus = sr.bonus
          newStreak = sr.newStreak
          player.streak = newStreak
        } else {
          points = 0
          bonus = 0
          newStreak = oldStreak
          player.streak = 0
        }
      }

      player.score += points
      player.cumulativeTime += timeSpent

      // Record answer for final results
      room.answers.push({
        playerId: pid,
        questionId: qstate.id,
        correct,
        timeSpent,
      })

      results.push({
        player_id: pid,
        nickname: player.nickname,
        correct,
        points,
        bonus,
        streak: correct ? player.streak : 0,
        cumulative_time: player.cumulativeTime,
      })
    }

    return results
  }

  /**
   * Send final results to the backend for persistence.
   */
  protected async sendResults(roomId: string): Promise<void> {
    const room = store.get(roomId)
    if (!room) return

    const sortedPlayers = [...room.players.values()].sort(
      (a, b) => b.score - a.score || a.cumulativeTime - b.cumulativeTime,
    )

    const scores = sortedPlayers.map(p => ({
      player_id: p.id,
      nickname: p.nickname,
      score: p.score,
      streak: p.streak,
      cumulative_time: p.cumulativeTime,
    }))

    const answers = room.answers.map(a => ({
      player_id: a.playerId,
      question_id: a.questionId,
      correct: a.correct,
      time_spent: a.timeSpent,
    }))

    await notifyBackend(roomId, 'results', { scores, answers })
  }
}

/* ------------------------------------------------------------------ */
/*  ClassicFlow (default game mode)                                    */
/* ------------------------------------------------------------------ */

export class ClassicFlow extends GameFlow {
  /** Round finishes when all active players have answered. */
  shouldFinishRound(room: Room): boolean {
    const active = activePlayers(room)
    if (active.length === 0) return false
    return active.every(p => room.answeredPlayers.has(p.id))
  }

  /** Classic mode never eliminates players mid-game. */
  shouldEliminate(_player: Player): boolean {
    return false
  }
}

/** Singleton flow instance. */
export const flow = new ClassicFlow()
