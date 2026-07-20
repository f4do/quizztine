import crypto from 'crypto'
import fs from 'fs/promises'
import net from 'net'
import path from 'path'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '../../prisma/generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError } from '../types/errors.js'

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

// SSRF protection: reject requests to private/reserved IP ranges
function isPrivateIP(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  if (net.isIP(hostname)) {
    const parts = hostname.split('.').map(Number)
    if (parts.length !== 4) return true
    // 10.0.0.0/8
    if (parts[0] === 10) return true
    // 127.0.0.0/8
    if (parts[0] === 127) return true
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true
  }
  return false
}

const fetchAvatarSchema = z.object({
  url: z.string().url('Invalid URL'),
})

const createHostSchema = z.object({
  name: z.string().min(1).max(100),
  avatarType: z.enum(['BUILTIN', 'UPLOAD', 'URL']).optional().default('BUILTIN'),
  avatarConfig: z.any().optional(),
  avatarUrl: z.string().url().or(z.string().startsWith('/uploads/')).nullable().optional(),
})

const updateHostSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarType: z.enum(['BUILTIN', 'UPLOAD', 'URL']).optional(),
  avatarConfig: z.any().optional(),
  avatarUrl: z.string().url().or(z.string().startsWith('/uploads/')).nullable().optional(),
  isActive: z.boolean().optional(),
})

const createPhraseSchema = z.object({
  context: z.string().min(1),
  lang: z.enum(['fr', 'en']),
  text: z.string().min(1),
  priority: z.number().int().optional(),
  scope: z.enum(['game', 'site']).optional(),
})

const updatePhraseSchema = z.object({
  context: z.string().min(1).optional(),
  lang: z.enum(['fr', 'en']).optional(),
  text: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  scope: z.enum(['game', 'site']).optional(),
})

const PHRASE_CONTEXTS = {
  pre: ['pre.solo', 'pre.welcome', 'ready.replay'],
  game: ['game.first', 'game.last', 'game.media_audio', 'game.media_video', 'question.default', 'question.easy', 'question.hard'],
  feedback: ['feedback.correct', 'feedback.correct_hard', 'feedback.first_correct', 'feedback.only_correct', 'feedback.correct_first_only', 'feedback.wrong', 'feedback.only_wrong', 'feedback.timeout', 'feedback.streak_3', 'feedback.streak_5', 'feedback.streak_10', 'feedback.last_second', 'feedback.streak_lost'],
  end: ['end.winner', 'end.second', 'end.third', 'end.last', 'end.low', 'end.default', 'end.perfect', 'end.tie'],
  site: ['home.welcome', 'home.new_candidate', 'login.welcome', 'register.welcome', 'room_create.welcome', 'profile.prompt', 'train.prompt', 'admin.dashboard', 'admin.question_form', 'error.message', 'site.after_register', 'site.after_login', 'site.after_logout', 'site.after_password_change', 'site.after_account_delete', 'site.room_created', 'site.admin_questions', 'site.admin_users', 'site.admin_categories'],
}

const PHRASE_VARIABLES: Record<string, string[]> = {
  'pre.solo': ['pseudo'],
  'pre.welcome': ['pseudo'],
  'ready.replay': ['pseudo'],
  'question.default': ['index', 'total', 'category'],
  'question.easy': ['index', 'total', 'category'],
  'question.hard': ['index', 'total', 'category'],
  'game.first': ['index', 'total', 'pseudo'],
  'game.last': ['index', 'total', 'pseudo'],
  'game.media_audio': ['category', 'pseudo'],
  'game.media_video': ['category', 'pseudo'],
  'feedback.correct': ['pseudo', 'points', 'score', 'streak'],
  'feedback.correct_hard': ['pseudo', 'points', 'score'],
  'feedback.first_correct': ['pseudo', 'points', 'score'],
  'feedback.only_correct': ['pseudo', 'points', 'score'],
  'feedback.correct_first_only': ['pseudo', 'points', 'score'],
  'feedback.wrong': ['pseudo', 'points', 'score'],
  'feedback.only_wrong': ['pseudo', 'score'],
  'feedback.timeout': ['pseudo', 'score'],
  'feedback.streak_3': ['pseudo', 'points', 'streak', 'score'],
  'feedback.streak_5': ['pseudo', 'points', 'streak', 'score'],
  'feedback.streak_10': ['pseudo', 'points', 'streak', 'score'],
  'feedback.last_second': ['pseudo', 'points', 'score'],
  'feedback.streak_lost': ['pseudo', 'streak', 'score'],
  'end.second': ['pseudo', 'score', 'total', 'correct_count', 'rank'],
  'end.third': ['pseudo', 'score', 'total', 'correct_count', 'rank'],
  'end.last': ['pseudo', 'score', 'total', 'correct_count', 'rank'],
  'end.low': ['pseudo', 'score', 'total', 'correct_count'],
  'end.default': ['pseudo', 'score', 'total', 'correct_count', 'rank'],
  'end.winner': ['pseudo', 'score', 'total', 'correct_count', 'rank'],
  'end.perfect': ['pseudo', 'score', 'total', 'correct_count'],
  'end.tie': ['pseudo', 'score', 'rank'],
  'profile.prompt': ['pseudo'],
  'site.after_register': ['pseudo'],
  'site.after_login': ['pseudo'],
  'site.room_created': ['code'],
  'site.admin_questions': ['count'],
}

// GET /host — list all hosts (admin)
export async function listHosts(_req: AuthenticatedRequest, res: Response) {
  const hosts = await prisma.host.findMany({ orderBy: { createdAt: 'asc' } })
  res.json({ hosts })
}

// GET /host/active — get active host (public)
export async function getActiveHost(_req: Request, res: Response) {
  const host = await prisma.host.findFirst({ where: { isActive: true } })
  if (!host) {
    return res.json({
      host: {
        id: 'default-host',
        name: 'Christine',
        avatarType: 'BUILTIN',
        avatarConfig: {
          topType: 'LongHairStraight2',
          hairColor: 'Red',
          accessoriesType: 'Blank',
          facialHairType: 'Blank',
          facialHairColor: 'Blank',
          clotheType: 'ShirtVNeck',
          clotheColor: 'Pink',
          skinColor: 'Brown',
        },
        avatarUrl: null,
      },
    })
  }
  res.json({ host })
}

// GET /host/:id — get one host (admin)
export async function getHost(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string
  const host = await prisma.host.findUnique({ where: { id } })
  if (!host) throw new AppError(404, 'HOST_NOT_FOUND', 'Host not found')
  res.json({ host })
}

// POST /host — create host (admin)
export async function createHost(req: AuthenticatedRequest, res: Response) {
  const data = createHostSchema.parse(req.body)
  const host = await prisma.host.create({ data })
  res.status(201).json({ host })
}

// PUT /host/:id — update host (admin)
export async function updateHost(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string
  const existing = await prisma.host.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'HOST_NOT_FOUND', 'Host not found')

  const data = updateHostSchema.parse(req.body)

  // Build update operations — if setting this host active, deactivate others in the same transaction
  const ops: Prisma.PrismaPromise<unknown>[] = []

  if (data.isActive) {
    ops.push(prisma.host.updateMany({
      where: { isActive: true, NOT: { id } },
      data: { isActive: false },
    }))
  }

  ops.push(prisma.host.update({
    where: { id },
    data,
  }))

  const results = await prisma.$transaction(ops)
  const host = results[results.length - 1]
  res.json({ host })
}

// DELETE /host/:id — delete host (admin)
export async function deleteHost(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string
  const existing = await prisma.host.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'HOST_NOT_FOUND', 'Host not found')
  if (existing.isActive) throw new AppError(400, 'CANNOT_DELETE_ACTIVE_HOST', 'Cannot delete the active host. Activate another host first.')
  await prisma.host.delete({ where: { id } })
  res.json({ message: 'Host deleted' })
}

// ─── Host Phrase CRUD ───────────────────────────────────────────

// GET /host/phrases — list phrases (admin only)
export async function listPhrases(req: AuthenticatedRequest, res: Response) {
  const { context, lang, scope } = req.query as { context?: string; lang?: string; scope?: string }

  const where: Record<string, string> = {}
  if (context) where.context = context
  if (lang) where.lang = lang
  if (scope) where.scope = scope

  const phrases = await prisma.hostPhrase.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: [{ context: 'asc' }, { priority: 'desc' }],
  })
  res.json({ phrases })
}

// GET /host/phrases/contexts — list available context names (admin only)
export async function getPhraseContexts(_req: AuthenticatedRequest, res: Response) {
  res.json({ contexts: PHRASE_CONTEXTS, variables: PHRASE_VARIABLES })
}

// GET /host/phrases/random — pick a random phrase (public)
export async function getRandomPhrase(req: Request, res: Response) {
  const context = req.query.context as string | undefined
  const lang = (req.query.lang as string) || 'fr'

  if (!context) {
    throw new AppError(400, 'VALIDATION_ERROR', 'context query parameter is required')
  }

  const phrases = await prisma.hostPhrase.findMany({
    where: { context, lang },
  })

  if (phrases.length === 0) {
    throw new AppError(404, 'PHRASE_NOT_FOUND', 'No phrase found for this context and language')
  }

  const phrase = phrases[Math.floor(Math.random() * phrases.length)]
  res.json({ phrase: { id: phrase.id, context: phrase.context, text: phrase.text, lang: phrase.lang } })
}

// POST /host/phrases — create a phrase (admin)
export async function createPhrase(req: AuthenticatedRequest, res: Response) {
  const data = createPhraseSchema.parse(req.body)
  const phrase = await prisma.hostPhrase.create({ data })
  res.status(201).json({ phrase })
}

// PUT /host/phrases/:id — update a phrase (admin)
export async function updatePhrase(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string
  const existing = await prisma.hostPhrase.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'PHRASE_NOT_FOUND', 'Phrase not found')

  const data = updatePhraseSchema.parse(req.body)
  const phrase = await prisma.hostPhrase.update({ where: { id }, data })
  res.json({ phrase })
}

// DELETE /host/phrases/:id — delete a phrase (admin)
export async function deletePhrase(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string
  const existing = await prisma.hostPhrase.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'PHRASE_NOT_FOUND', 'Phrase not found')

  await prisma.hostPhrase.delete({ where: { id } })
  res.json({ message: 'Phrase deleted' })
}

// POST /host/fetch-avatar — download an image from URL and store locally
export async function fetchAvatar(req: AuthenticatedRequest, res: Response) {
  const parsed = fetchAvatarSchema.parse(req.body)
  const url = new URL(parsed.url)

  // SSRF protection: reject private/reserved IPs
  if (isPrivateIP(url.hostname)) {
    throw new AppError(400, 'SSRF_BLOCKED', 'URL points to a private or reserved address')
  }

  // Download the image
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new AppError(400, 'DOWNLOAD_FAILED', `Failed to download image: ${response.status}`)

  const rawContentType = response.headers.get('content-type') || ''
  const contentType = rawContentType.split(';')[0].trim()
  const buffer = Buffer.from(await response.arrayBuffer())

  // Validate content type
  if (!contentType.startsWith('image/')) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'URL must point to an image')
  }

  // Determine extension from content-type
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }
  const ext = extMap[contentType] || '.jpg'

  // Validate extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new AppError(400, 'INVALID_FILE_TYPE', `File type ${ext} is not allowed`)
  }

  // Save file with UUID filename
  const filename = `${crypto.randomUUID()}${ext}`
  const filepath = path.join(config.uploadDir, filename)
  await fs.mkdir(config.uploadDir, { recursive: true })
  await fs.writeFile(filepath, buffer)

  const avatarUrl = `/uploads/${filename}`
  res.json({ avatarUrl })
}
