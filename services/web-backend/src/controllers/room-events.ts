import { getIO } from '../lib/socket.js'
import type { QuestionFinishedPayload } from '../engine/types.js'

function emitToRoom(roomId: string, event: string, payload: unknown) {
  try {
    const io = getIO()
    io.to(`room:${roomId}`).emit(event, payload)
  } catch {
    // Socket.IO may not be initialized in tests; events are best-effort.
  }
}

/* ── Pure handlers (called by notifications.ts from the engine) ──── */

export function handleQuestionFinished(roomId: string, data: QuestionFinishedPayload): void {
  emitToRoom(roomId, 'question-feedback', data)
}

export function handleNextQuestion(roomId: string, data: unknown): void {
  emitToRoom(roomId, 'next-question', data)
}

export function handleGameFinished(roomId: string): void {
  emitToRoom(roomId, 'game-finished', {})
}

/* ── Express handlers removed (dead code, engine is now in-process) ─ */
