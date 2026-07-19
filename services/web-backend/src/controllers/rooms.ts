import { prisma } from '../lib/prisma.js'
import { ValidationError, ForbiddenError } from '../types/errors.js'
import { engineClient } from '../lib/engine-client.js'
import logger from '../lib/logger.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import crypto from 'crypto'

function generateRoomCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
}

export async function createRoom(req: AuthenticatedRequest, res: Response) {
  const { mode, questionCount, categories, difficulties, timer, includePrivate } = req.body as {
    mode?: string
    questionCount?: number
    categories?: string[]
    difficulties?: string | string[]
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
  if (difficulties && Array.isArray(difficulties) && difficulties.length > 0) {
    where.difficulty = { in: difficulties }
  } else if (difficulties && typeof difficulties === 'string') {
    where.difficulty = difficulties
  }

  const availableQuestions = await prisma.question.findMany({ where })
  const count = questionCount ?? 10
  const usedCount = Math.min(count, Math.max(availableQuestions.length, 1))

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
      questionCount: usedCount,
      creatorId: req.user?.id ?? null,
    },
  })

  // Build payload for quiz-engine
  const enginePayload = {
    questions: selectedQuestions.map((q) => {
      const choices = q.choices as Array<{ text: string; isCorrect: boolean }>
      return {
        id: q.id,
        correct_choices: choices
          .map((c, i) => (c.isCorrect ? i : -1))
          .filter((i) => i !== -1),
        difficulty: q.difficulty.toLowerCase(),
        question_type: q.questionType,
      }
    }),
    mode,
    timer: timer ?? 30,
  }

  // Call quiz-engine to register the room
  try {
    await engineClient.createRoom({
      id: room.id,
      questions: enginePayload.questions,
      mode: enginePayload.mode,
      timer: enginePayload.timer,
      code: room.code,
      creator_player_id: creatorPlayerId,
    })
  } catch (err) {
    // Clean up the DB room if engine call fails
    await prisma.room.delete({ where: { id: room.id } }).catch(() => {})
    throw err
  }

  logger.info({ event: 'room-created', roomId: room.id, code, questionCount: selectedQuestions.length }, 'Room created')

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
  await engineClient.joinRoom(roomId, { player_id, nickname })

  // Map authenticated user to player session for stats attribution
  if (req.user) {
    await prisma.roomPlayer.upsert({
      where: { roomId_playerId: { roomId, playerId: player_id } },
      create: { roomId, playerId: player_id, userId: req.user.id, nickname },
      update: { userId: req.user.id, nickname },
    })
  }

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

export async function replayRoom(req: AuthenticatedRequest, res: Response) {
  const roomId = req.params.id as string

  // Fetch the DB room to get original params
  const dbRoom = await prisma.room.findUnique({ where: { id: roomId } })
  if (!dbRoom) {
    res.status(404).json({ error: 'Room not found', code: 'ROOM_NOT_FOUND', status: 404 })
    return
  }

  // Fetch new random questions from DB
  const where: Record<string, unknown> = { visibility: 'PUBLIC' }
  const availableQuestions = await prisma.question.findMany({ where })
  const count = dbRoom.questionCount
  const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
  const selectedQuestions = shuffled.length > count ? shuffled.slice(0, count) : shuffled

  if (selectedQuestions.length === 0) {
    res.status(400).json({ error: 'No questions available', code: 'NO_QUESTIONS', status: 400 })
    return
  }

  // Build engine payload
  const newQuestions = selectedQuestions.map((q) => {
    const choices = q.choices as Array<{ text: string; isCorrect: boolean }>
    return {
      id: q.id,
      correct_choices: choices
        .map((c, i) => (c.isCorrect ? i : -1))
        .filter((i) => i !== -1),
      difficulty: q.difficulty.toLowerCase(),
      question_type: q.questionType,
    }
  })

  // Call engine to replace questions and reset the room
  await engineClient.replayRoom(roomId, { questions: newQuestions })

  // Broadcast to all players so they return to pre-game
  try {
    const { getIO } = await import('../lib/socket.js')
    const io = getIO()
    io.to(`room:${roomId}`).emit('room-replayed', {})
  } catch {
    // Socket.IO may not be initialized; event is best-effort
  }
  res.json({ status: 'replayed' })
}
