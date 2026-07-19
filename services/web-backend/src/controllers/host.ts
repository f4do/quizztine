import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError } from '../types/errors.js'

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

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
  const ops: any[] = []

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

// POST /host/fetch-avatar — download an image from URL and store locally
export async function fetchAvatar(req: AuthenticatedRequest, res: Response) {
  const { url } = req.body as { url: string }
  if (!url || typeof url !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'URL is required')
  }

  // Validate URL format
  try { new URL(url) } catch { throw new AppError(400, 'VALIDATION_ERROR', 'Invalid URL') }

  // Download the image
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new AppError(400, 'DOWNLOAD_FAILED', `Failed to download image: ${response.status}`)

  const contentType = response.headers.get('content-type') || ''
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
