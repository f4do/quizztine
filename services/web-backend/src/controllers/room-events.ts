import { z } from 'zod'
import { getIO } from '../lib/socket.js'
import type { Request, Response } from 'express'
import type { QuestionFinishedPayload } from '../engine/types.js'

const playerResultSchema = z.object({
  player_id: z.string().min(1),
  nickname: z.string().min(1),
  correct: z.boolean(),
  points: z.number().int().min(0),
  bonus: z.number().int().min(0),
  streak: z.number().int().min(0),
  cumulative_time: z.number().min(0),
})

const questionFinishedSchema = z.object({
  question_id: z.number().int(),
  correct_choices: z.array(z.number().int()),
  results: z.array(playerResultSchema),
})

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

/* ── Express handlers (kept for backward compat; no longer routed) ─ */

export function questionFinished(req: Request, res: Response) {
  const parsed = questionFinishedSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid question-finished payload', details: parsed.error.issues })
    return
  }

  handleQuestionFinished(req.params.id as string, parsed.data)
  res.json({ message: 'Question finished event broadcasted' })
}

export function nextQuestion(req: Request, res: Response) {
  handleNextQuestion(req.params.id as string, req.body ?? {})
  res.json({ message: 'Next question event broadcasted' })
}

export function gameFinished(req: Request, res: Response) {
  handleGameFinished(req.params.id as string)
  res.json({ message: 'Game finished event broadcasted' })
}
