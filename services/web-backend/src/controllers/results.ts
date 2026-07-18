import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getIO } from '../lib/socket.js'
import { NotFoundError, ValidationError } from '../types/errors.js'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'

const scoreSchema = z.object({
  player_id: z.string().min(1),
  nickname: z.string().min(1),
  score: z.number().int().min(0),
  streak: z.number().int().min(0),
  cumulative_time: z.number().min(0),
})

const answerSchema = z.object({
  player_id: z.string().min(1),
  question_id: z.number().int(),
  correct: z.boolean(),
  time_spent: z.number().min(0),
})

const resultsSchema = z.object({
  scores: z.array(scoreSchema).min(1),
  answers: z.array(answerSchema),
})

export async function receiveResults(req: Request, res: Response) {
  const parsed = resultsSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid results payload', parsed.error.issues)
  }

  const { scores, answers } = parsed.data
  const roomId = req.params.id as string

  await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId } })
    if (!room) {
      throw new NotFoundError('Room not found')
    }

    await tx.room.update({ where: { id: roomId }, data: { status: 'finished' } })

    const gameResult = await tx.gameResult.create({
      data: {
        roomId,
        mode: room.mode,
        scores: {
          createMany: {
            data: scores.map(s => ({
              playerId: s.player_id,
              nickname: s.nickname,
              score: s.score,
              streak: s.streak,
              cumulativeTime: s.cumulative_time,
            })),
          },
        },
        answers: {
          createMany: {
            data: answers.map(a => ({
              playerId: a.player_id,
              questionId: a.question_id,
              correct: a.correct,
              timeSpent: a.time_spent,
            })),
          },
        },
      },
    })

    const nicknames = [...new Set(scores.map(s => s.nickname))]
    const users = await tx.user.findMany({
      where: { pseudo: { in: nicknames } },
      select: { id: true, pseudo: true },
    })
    const userByPseudo = new Map(users.map(u => [u.pseudo, u.id]))

    for (const score of scores) {
      const userId = userByPseudo.get(score.nickname)
      if (!userId) continue
      await tx.userStat.upsert({
        where: { userId },
        update: {
          gamesPlayed: { increment: 1 },
          totalScore: { increment: score.score },
        },
        create: {
          userId,
          gamesPlayed: 1,
          totalScore: score.score,
        },
      })
    }

    if (answers.length > 0) {
      const questionIds = [...new Set(answers.map(a => a.question_id))]
      const questions = await tx.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, category: true },
      })
      const categoryByQuestion = new Map(questions.map(q => [q.id, q.category]))

      for (const answer of answers) {
        const scoreEntry = scores.find(s => s.player_id === answer.player_id)
        if (!scoreEntry) continue
        const userId = userByPseudo.get(scoreEntry.nickname)
        if (!userId) continue
        const category = categoryByQuestion.get(answer.question_id)
        if (!category) continue
        await tx.userThemeStat.upsert({
          where: { userId_category: { userId, category } },
          update: {
            totalAnswered: { increment: 1 },
            correctCount: { increment: answer.correct ? 1 : 0 },
          },
          create: {
            userId,
            category,
            totalAnswered: 1,
            correctCount: answer.correct ? 1 : 0,
          },
        })
      }
    }

    return gameResult
  })

  console.log(JSON.stringify({ event: 'room-finished', roomId, scores }))

  try {
    getIO().to(`room:${roomId}`).emit('game-finished', {})
  } catch {
    // Socket.IO may not be initialized in tests; events are best-effort.
  }

  res.json({ message: 'Results received' })
}

export async function getResults(req: Request, res: Response) {
  const roomId = req.params.id as string
  const result = await prisma.gameResult.findUnique({
    where: { roomId },
    include: { scores: true, answers: true },
  })
  if (!result) {
    throw new NotFoundError('Results not found')
  }
  res.json({ result })
}

export async function getMyStats(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new NotFoundError('User not found')
  }
  const stat = await prisma.userStat.findUnique({ where: { userId: req.user.id } })
  const themeStats = await prisma.userThemeStat.findMany({
    where: { userId: req.user.id },
    orderBy: { category: 'asc' },
  })
  res.json({
    stat: stat ?? { gamesPlayed: 0, totalScore: 0 },
    themeStats: themeStats.map(t => ({
      category: t.category,
      totalAnswered: t.totalAnswered,
      correctCount: t.correctCount,
      successRate: t.totalAnswered > 0 ? Math.round((t.correctCount / t.totalAnswered) * 100) : 0,
    })),
  })
}
