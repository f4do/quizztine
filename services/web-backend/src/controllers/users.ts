import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma.js'
import {
  updateProfileSchema,
  updatePasswordSchema,
  adminUpdateUserSchema,
  adminResetPasswordSchema,
} from '../lib/validation.js'
import { NotFoundError, ValidationError, ForbiddenError, AuthError } from '../types/errors.js'
import { Role } from '../../prisma/generated/prisma/client.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, pseudo: true, email: true, role: true, totpEnabled: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ users })
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string

  const parsed = adminUpdateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    throw new NotFoundError('User not found')
  }

  const data: Record<string, string> = {}
  if (parsed.data.pseudo) data.pseudo = parsed.data.pseudo
  if (parsed.data.email) data.email = parsed.data.email

  // Prevent self-demotion from QUIZADMIN
  if (id === req.user!.id && parsed.data.role && parsed.data.role !== 'QUIZADMIN') {
    throw new ForbiddenError('Cannot demote yourself from QUIZADMIN')
  }

  if (data.pseudo || data.email) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          ...(data.pseudo ? [{ pseudo: data.pseudo }] : []),
          ...(data.email ? [{ email: data.email }] : []),
        ],
        NOT: { id },
      },
    })
    if (existing) {
      throw new ValidationError('Pseudo or email already taken')
    }
  }

  const updateData: Record<string, string> = { ...data }
  if (parsed.data.role) updateData.role = parsed.data.role

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, pseudo: true, email: true, role: true, totpEnabled: true, emailVerified: true, createdAt: true },
  })

  res.json({ user: updated })
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    throw new NotFoundError('User not found')
  }

  if (id === req.user!.id) {
    throw new ForbiddenError('Cannot delete your own account from user management')
  }

  await prisma.$transaction([
    prisma.question.updateMany({ where: { authorId: id }, data: { authorId: null } }),
    prisma.questionReport.updateMany({ where: { reporterId: id }, data: { reporterId: null } }),
    prisma.room.updateMany({ where: { creatorId: id }, data: { creatorId: null } }),
    prisma.user.delete({ where: { id } }),
  ])

  res.json({ message: 'User deleted successfully' })
}

export async function resetUserPassword(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string

  const parsed = adminResetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    throw new NotFoundError('User not found')
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12)
  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  })

  res.json({ message: 'Password reset successfully' })
}

export async function resetUserTOTP(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    throw new NotFoundError('User not found')
  }

  await prisma.user.update({
    where: { id },
    data: { totpSecret: null, totpEnabled: false },
  })

  res.json({ message: 'TOTP reset successfully' })
}

function sanitizeUser(user: {
  id: string
  pseudo: string
  email: string
  role: string
  language: string
  theme: string
  emailVerified: boolean
  createdAt: Date
}) {
  return {
    id: user.id,
    pseudo: user.pseudo,
    email: user.email,
    role: user.role,
    language: user.language,
    theme: user.theme,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new AuthError()
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) {
    throw new NotFoundError('User not found')
  }

  res.json({ user: sanitizeUser(user) })
}

export async function updateMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new AuthError()
  }

  const parsed = updateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const data: Record<string, string> = {}
  if (parsed.data.pseudo) data.pseudo = parsed.data.pseudo
  if (parsed.data.email) data.email = parsed.data.email

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No fields to update')
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(data.pseudo ? [{ pseudo: data.pseudo }] : []),
        ...(data.email ? [{ email: data.email }] : []),
      ],
      NOT: { id: req.user.id },
    },
  })
  if (existing) {
    throw new ValidationError('Pseudo or email already taken')
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
  })

  res.json({ user: sanitizeUser(user) })
}

export async function updateMyPassword(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new AuthError()
  }

  const parsed = updatePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const { currentPassword, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) {
    throw new NotFoundError('User not found')
  }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) {
    throw new AuthError('Current password is incorrect')
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedPassword },
  })

  res.json({ message: 'Password updated successfully' })
}

export async function deleteMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new AuthError()
  }

  const { password } = req.body as { password?: string }
  if (!password) {
    throw new ValidationError('Password is required')
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) {
    throw new NotFoundError('User not found')
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw new AuthError('Password is incorrect')
  }

  await prisma.$transaction([
    prisma.question.updateMany({ where: { authorId: req.user.id }, data: { authorId: null } }),
    prisma.questionReport.updateMany({ where: { reporterId: req.user.id }, data: { reporterId: null } }),
    prisma.room.updateMany({ where: { creatorId: req.user.id }, data: { creatorId: null } }),
    prisma.user.delete({ where: { id: req.user.id } }),
  ])

  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/' })

  res.json({ message: 'Account deleted successfully' })
}
