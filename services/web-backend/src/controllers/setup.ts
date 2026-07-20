import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signAccessToken, signRefreshToken } from '../lib/jwt.js'
import { setTokenCookies } from './auth.js'
import { setupSchema } from '../lib/validation.js'
import { loadSeedData } from '../seed-data/index.js'
import { AppError } from '../types/errors.js'
import logger from '../lib/logger.js'
import type { Request, Response } from 'express'
import type { Prisma } from '../../prisma/generated/prisma/client.js'

export async function setupStatus(_req: Request, res: Response) {
  const adminCount = await prisma.user.count({
    where: { role: 'QUIZADMIN' },
  })

  res.json({ needsSetup: adminCount === 0 })
}

export async function setup(req: Request, res: Response) {
  const parsed = setupSchema.safeParse(req.body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new AppError(400, 'VALIDATION_ERROR', firstIssue.message)
  }

  const { pseudo, email, password, language } = parsed.data

  // Check if any QUIZADMIN already exists (inside transaction for race condition safety)
  const [admin] = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.count({
      where: { role: 'QUIZADMIN' },
    })
    if (existing > 0) {
      throw new AppError(400, 'SETUP_ALREADY_DONE', 'An admin already exists. Setup is no longer available.')
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await tx.user.create({
      data: {
        pseudo,
        email,
        password: hashedPassword,
        role: 'QUIZADMIN',
        emailVerified: true,
        language,
      },
    })

    // Load and seed categories + questions
    const seedData = loadSeedData(language)

    for (const cat of seedData.categories) {
      await tx.category.upsert({
        where: { name: cat.name },
        update: {},
        create: { name: cat.name },
      })
    }

    for (const q of seedData.questions) {
      await tx.question.upsert({
        where: { seedKey: q.seedKey },
        update: {},
        create: {
          seedKey: q.seedKey,
          text: q.text,
          difficulty: q.difficulty,
          category: q.category,
          choices: q.choices as unknown as Prisma.InputJsonValue,
          explanation: q.explanation,
          questionType: 'MCQ',
          visibility: 'PUBLIC',
        },
      })
    }

    return [user]
  })

  // Seed default hosts (outside transaction — not critical)
  const hostData = [
    { id: 'default-host', name: 'Christine', avatarType: 'BUILTIN' as const, avatarConfig: { topType: 'LongHairStraight2', hairColor: 'Red', accessoriesType: 'Blank', facialHairType: 'Blank', facialHairColor: 'Blank', clotheType: 'ShirtVNeck', clotheColor: 'Pink', skinColor: 'Brown' }, isActive: true },
    { id: 'default-host-christian', name: 'Christian', avatarType: 'BUILTIN' as const, avatarConfig: { topType: 'ShortHairSides', hairColor: 'Platinum', accessoriesType: 'Blank', facialHairType: 'MoustacheMagnum', facialHairColor: 'Platinum', clotheType: 'BlazerSweater', clotheColor: 'Gray02', skinColor: 'Pale', spotColor: '#E8A87C' }, isActive: false },
  ]

  for (const host of hostData) {
    await prisma.host.upsert({
      where: { id: host.id },
      update: {},
      create: host,
    })
  }

  // Sign JWTs
  const tokenPayload = { id: admin.id, pseudo: admin.pseudo, email: admin.email, role: admin.role }
  const accessToken = await signAccessToken(tokenPayload)
  const refreshToken = await signRefreshToken(tokenPayload)
  setTokenCookies(res, accessToken, refreshToken)

  logger.info(
    { event: 'setup-complete', userId: admin.id, language },
    'First admin setup completed',
  )

  res.status(201).json({
    user: {
      id: admin.id,
      pseudo: admin.pseudo,
      email: admin.email,
      role: admin.role,
      language: admin.language,
      theme: admin.theme,
    },
  })
}
