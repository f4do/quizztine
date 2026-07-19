import { prisma } from '../lib/prisma.js'
import { createQuestionSchema, updateQuestionSchema } from '../lib/question-validation.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../types/errors.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import type { Prisma } from '../../prisma/generated/prisma/client.js'

export async function listQuestions(req: AuthenticatedRequest, res: Response) {
  const { category, difficulty, visibility } = req.query as Record<string, string | undefined>
  const isAdmin = req.user?.role === 'QUIZADMIN'
  const isQuizmaster = req.user?.role === 'QUIZMASTER' || isAdmin

  const where: Prisma.QuestionWhereInput = {}

  if (category) where.category = category
  if (difficulty) where.difficulty = difficulty as Prisma.EnumDifficultyFilter['equals']

  // Visibility filter
  if (!req.user) {
    where.visibility = 'PUBLIC'
  } else if (visibility === 'PUBLIC') {
    where.visibility = 'PUBLIC'
  } else if (visibility === 'PRIVATE' && isQuizmaster) {
    if (isAdmin) {
      where.visibility = 'PRIVATE' // admin sees ALL private
    } else {
      where.OR = [
        { visibility: 'PUBLIC' },
        { visibility: 'PRIVATE', authorId: req.user!.id },
      ]
    }
  } else if (isAdmin && !visibility) {
    // admin default: all public + all private
  } else if (isQuizmaster && !visibility) {
    // quizmaster default: own private + all public
    where.OR = [
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', authorId: req.user!.id },
    ]
  } else {
    where.visibility = 'PUBLIC'
  }

  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  res.json({ questions })
}

export async function getQuestion(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(req.params.id as string, 10)
  if (isNaN(id)) {
    throw new ValidationError('Invalid question ID')
  }

  const question = await prisma.question.findUnique({ where: { id } })
  if (!question) {
    throw new NotFoundError('Question not found')
  }

  // Private question check
  if (question.visibility === 'PRIVATE' && question.authorId !== req.user?.id && req.user?.role !== 'QUIZADMIN') {
    throw new NotFoundError('Question not found')
  }

  // If ?game=true, strip isCorrect from choices (gameplay mode)
  if (req.query.game === 'true') {
    const choices = question.choices as Array<{ text: string; isCorrect: boolean }>
    const sanitizedChoices = choices.map(({ isCorrect: _, ...rest }) => rest)
    res.json({ question: { ...question, choices: sanitizedChoices } })
    return
  }

  res.json({ question })
}

export async function createQuestion(req: AuthenticatedRequest, res: Response) {
  if (!req.user || (req.user.role !== 'QUIZMASTER' && req.user.role !== 'QUIZADMIN')) {
    throw new ForbiddenError('Only quizmasters and admins can create questions')
  }

  const parsed = createQuestionSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const { choices, ...rest } = parsed.data
  const question = await prisma.question.create({
    data: {
      ...rest,
      choices: choices as Prisma.InputJsonValue,
      authorId: req.user.id,
    },
  })

  res.status(201).json({ question })
}

export async function updateQuestion(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(req.params.id as string, 10)
  if (isNaN(id)) {
    throw new ValidationError('Invalid question ID')
  }

  const existing = await prisma.question.findUnique({ where: { id } })
  if (!existing) {
    throw new NotFoundError('Question not found')
  }

  // Only author or quizadmin can update
  if (existing.authorId !== req.user?.id && req.user?.role !== 'QUIZADMIN') {
    throw new ForbiddenError('Not allowed to update this question')
  }

  const parsed = updateQuestionSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const { choices: updateChoices, ...updateRest } = parsed.data
  const question = await prisma.question.update({
    where: { id },
    data: {
      ...updateRest,
      ...(updateChoices !== undefined ? { choices: updateChoices as Prisma.InputJsonValue } : {}),
    },
  })

  res.json({ question })
}

export async function deleteQuestion(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(req.params.id as string, 10)
  if (isNaN(id)) {
    throw new ValidationError('Invalid question ID')
  }

  const existing = await prisma.question.findUnique({ where: { id } })
  if (!existing) {
    throw new NotFoundError('Question not found')
  }

  // Only author or quizadmin can delete
  if (existing.authorId !== req.user?.id && req.user?.role !== 'QUIZADMIN') {
    throw new ForbiddenError('Not allowed to delete this question')
  }

  await prisma.question.delete({ where: { id } })

  res.json({ message: 'Question deleted' })
}
