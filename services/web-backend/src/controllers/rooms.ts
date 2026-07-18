import { prisma } from '../lib/prisma.js'
import { ValidationError, ForbiddenError } from '../types/errors.js'
import { engineClient } from '../lib/engine-client.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import crypto from 'crypto'

function generateRoomCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
}

export async function createRoom(req: AuthenticatedRequest, res: Response) {
  const { mode, questionCount, categories, difficulty, timer, includePrivate } = req.body as {
    mode?: string
    questionCount?: number
    categories?: string[]
    difficulty?: string
    timer?: number
    includePrivate?: boolean
  }

  if (!mode || !['solo', 'multi_private', 'multi_public'].includes(mode)) {
    throw new ValidationError('Mode must be solo, multi_private, or multi_public')
  }

  // Non-auth users can only create solo rooms
  if (!req.user && mode !== 'solo') {
    throw new ForbiddenError('Authentication required for multiplayer rooms')
  }

  const isQuizmaster = req.user && (req.user.role === 'QUIZMASTER' || req.user.role === 'QUIZADMIN')

  // Build question filter
  const where: Record<string, unknown> = { visibility: 'PUBLIC' }
  if (isQuizmaster && includePrivate) {
    where.OR = [
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', authorId: req.user!.id },
    ]
  }
  if (categories && categories.length > 0) {
    where.category = { in: categories }
  }
  if (difficulty) {
    where.difficulty = difficulty
  }

  const availableQuestions = await prisma.question.findMany({ where })
  const count = questionCount ?? 10

  // Pseudo-random selection: always shuffle, even when using all
  const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
  let selectedQuestions = shuffled
  let warning: string | undefined
  if (availableQuestions.length < count) {
    warning = `Only ${availableQuestions.length} questions available (requested ${count})`
  } else if (availableQuestions.length > count) {
    selectedQuestions = shuffled.slice(0, count)
  }

  if (selectedQuestions.length === 0) {
    throw new ValidationError('No questions match the selected criteria')
  }

  // Generate room
  const code = generateRoomCode()
  const creatorPlayerId = req.user && mode !== 'solo' ? `${req.user.pseudo}-${Date.now()}` : undefined
  const room = await prisma.room.create({
    data: {
      code,
      mode,
      timer: timer ?? 30,
      creatorId: req.user?.id ?? null,
    },
  })

  // Build payload for quiz-engine
  const enginePayload = {
    questions: selectedQuestions.map((q) => {
      const choices = q.choices as Array<{ text: string; isCorrect: boolean }>
      return {
        id: q.id,
        correctChoices: choices
          .map((c, i) => (c.isCorrect ? i : -1))
          .filter((i) => i !== -1),
        difficulty: q.difficulty.toLowerCase(),
      }
    }),
    mode,
    timer: timer ?? 30,
  }

  // Call quiz-engine to register the room
  try {
    await engineClient.createRoom(room.id, enginePayload.questions, enginePayload.mode, enginePayload.timer, room.code, creatorPlayerId)
  } catch (err) {
    // Clean up the DB room if engine call fails
    await prisma.room.delete({ where: { id: room.id } }).catch(() => {})
    throw err
  }

  console.log(JSON.stringify({ event: 'room-created', roomId: room.id, code, questionCount: selectedQuestions.length }))

  res.status(201).json({
    room: {
      id: room.id,
      code: room.code,
      mode: room.mode,
      timer: room.timer,
      creatorPlayerId,
    },
    ...(mode !== 'solo' ? { inviteLink: `/room/${room.id}` } : {}),
    ...(warning ? { warning } : {}),
  })
}

export async function getRoomByCode(req: AuthenticatedRequest, res: Response) {
  const { code } = req.params as { code: string }
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } })
  if (!room) {
    res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND', status: 404 })
    return
  }
  res.json({ id: room.id, code: room.code, mode: room.mode, timer: room.timer })
}

export async function getRoomState(req: AuthenticatedRequest, res: Response) {
  const roomId = req.params.id as string
  const data = await engineClient.getRoom(roomId)
  res.json(data)
}

export async function joinRoom(req: AuthenticatedRequest, res: Response) {
  const roomId = req.params.id as string
  const { player_id, nickname } = req.body as { player_id: string; nickname: string }
  await engineClient.joinRoom(roomId, player_id, nickname)
  res.json({ status: 'joined' })
}

export async function startGame(req: AuthenticatedRequest, res: Response) {
  const roomId = req.params.id as string
  const playerId = req.query.player_id as string
  await engineClient.startGame(roomId, playerId)
  res.json({ status: 'started' })
}

export async function getCurrentQuestion(req: AuthenticatedRequest, res: Response) {
  const roomId = req.params.id as string
  const playerId = req.params.playerId as string
  const data = await engineClient.getCurrentQuestion(roomId, playerId)
  res.json(data)
}

export async function getScoreboard(req: AuthenticatedRequest, res: Response) {
  const roomId = req.params.id as string
  const data = await engineClient.getScoreboard(roomId)
  res.json(data)
}
