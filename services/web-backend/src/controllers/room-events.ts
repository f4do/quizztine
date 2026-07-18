import { z } from 'zod'
import { getIO } from '../lib/socket.js'
import type { Request, Response } from 'express'

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

export function questionFinished(req: Request, res: Response) {
  const parsed = questionFinishedSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid question-finished payload', details: parsed.error.issues })
    return
  }

  emitToRoom(req.params.id as string, 'question-feedback', parsed.data)
  res.json({ message: 'Question finished event broadcasted' })
}

export function nextQuestion(req: Request, res: Response) {
  emitToRoom(req.params.id as string, 'next-question', req.body ?? {})
  res.json({ message: 'Next question event broadcasted' })
}

export function gameFinished(req: Request, res: Response) {
  emitToRoom(req.params.id as string, 'game-finished', {})
  res.json({ message: 'Game finished event broadcasted' })
}
