import { prisma } from '../lib/prisma.js'
import { ValidationError, NotFoundError } from '../types/errors.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'

// Simple rolling window rate limiter per user/IP
const reportLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = reportLimits.get(key)
  if (!entry || now > entry.resetAt) {
    reportLimits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) {
    return false
  }
  entry.count++
  return true
}

export async function reportQuestion(req: AuthenticatedRequest, res: Response) {
  const questionId = parseInt(req.params.questionId as string, 10)
  if (isNaN(questionId)) {
    throw new ValidationError('Invalid question ID')
  }

  const { reason } = req.body as { reason?: string }
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Reason is required')
  }

  const question = await prisma.question.findUnique({ where: { id: questionId } })
  if (!question) {
    throw new NotFoundError('Question not found')
  }

  // Rate limiting
  if (req.user) {
    if (req.user.role === 'QUIZMASTER' || req.user.role === 'QUIZADMIN') {
      // No limit for quizmaster+
    } else {
      if (!checkRateLimit(`user:${req.user.id}`, 10, 60 * 60 * 1000)) {
        res.status(429).json({ error: 'Too many reports. Try again later.', code: 'RATE_LIMITED', status: 429 })
        return
      }
    }
  } else {
    // Non-auth: IP rate limit + CAPTCHA
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    if (!checkRateLimit(`ip:${ip}`, 3, 60 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many reports. Please try again later.', code: 'RATE_LIMITED', status: 429 })
      return
    }
    // CAPTCHA verification would go here
  }

  await prisma.questionReport.create({
    data: {
      questionId,
      reporterId: req.user?.id ?? null,
      reason: reason.trim(),
    },
  })

  res.json({ message: 'Report submitted' })
}
