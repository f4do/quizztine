import { prisma } from '../lib/prisma.js'
import { ForbiddenError } from '../types/errors.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'

export async function listCategories(_req: AuthenticatedRequest, res: Response) {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  res.json({ categories })
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  if (req.user?.role !== 'QUIZADMIN') throw new ForbiddenError('Only admins can manage categories')

  const { name } = req.body as { name?: string }
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Category name is required', code: 'VALIDATION_ERROR', status: 400 })
    return
  }

  const existing = await prisma.category.findUnique({ where: { name: name.trim() } })
  if (existing) {
    res.status(409).json({ error: 'Category already exists', code: 'CONFLICT', status: 409 })
    return
  }

  const category = await prisma.category.create({ data: { name: name.trim() } })
  res.status(201).json({ category })
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response) {
  if (req.user?.role !== 'QUIZADMIN') throw new ForbiddenError('Only admins can manage categories')

  const id = parseInt(req.params.id as string, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid category ID', code: 'VALIDATION_ERROR', status: 400 })
    return
  }

  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Category not found', code: 'NOT_FOUND', status: 404 })
    return
  }

  await prisma.category.delete({ where: { id } })
  res.json({ message: 'Category deleted' })
}
