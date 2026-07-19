import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listCategories, createCategory, deleteCategory } from '../categories.js'
import { mockReq, mockRes } from '../../test/utils.js'
import { ForbiddenError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockFindMany, mockFindUnique, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    category: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      delete: mockDelete,
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const categories = [
  { id: 1, name: 'Geography' },
  { id: 2, name: 'History' },
  { id: 3, name: 'Science' },
]

describe('listCategories', () => {
  it('returns all categories ordered by name', async () => {
    mockFindMany.mockResolvedValue(categories)

    const req = mockReq()
    const res = mockRes()
    await listCategories(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
    expect(res.json).toHaveBeenCalledWith({ categories })
  })

  it('returns empty array when no categories exist', async () => {
    mockFindMany.mockResolvedValue([])

    const req = mockReq()
    const res = mockRes()
    await listCategories(req, res)

    expect(res.json).toHaveBeenCalledWith({ categories: [] })
  })
})

describe('createCategory', () => {
  it('creates category as QUIZADMIN', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 4, name: 'Math' })

    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { name: 'Math' },
    })
    const res = mockRes()
    await createCategory(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { name: 'Math' } })
    expect(mockCreate).toHaveBeenCalledWith({ data: { name: 'Math' } })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ category: { id: 4, name: 'Math' } })
  })

  it('throws ForbiddenError for non-admin', async () => {
    const req = mockReq({
      user: { id: 'user1', pseudo: 'user', email: 'user@test.com', role: 'USER' },
      body: { name: 'Math' },
    })
    const res = mockRes()

    await expect(createCategory(req, res)).rejects.toThrow(ForbiddenError)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws ForbiddenError for QUIZMASTER', async () => {
    const req = mockReq({
      user: { id: 'qm1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
      body: { name: 'Math' },
    })
    const res = mockRes()

    await expect(createCategory(req, res)).rejects.toThrow(ForbiddenError)
  })

  it('returns 409 for duplicate name', async () => {
    mockFindUnique.mockResolvedValue({ id: 1, name: 'Science' })

    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { name: 'Science' },
    })
    const res = mockRes()
    await createCategory(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'Category already exists', code: 'CONFLICT', status: 409 })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for empty name', async () => {
    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { name: '' },
    })
    const res = mockRes()
    await createCategory(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Category name is required', code: 'VALIDATION_ERROR', status: 400 })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for name with only whitespace', async () => {
    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { name: '   ' },
    })
    const res = mockRes()
    await createCategory(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for non-string name', async () => {
    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: { name: 123 },
    })
    const res = mockRes()
    await createCategory(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when name is missing', async () => {
    const req = mockReq({
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
      body: {},
    })
    const res = mockRes()
    await createCategory(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('deleteCategory', () => {
  it('deletes category as QUIZADMIN', async () => {
    mockFindUnique.mockResolvedValue({ id: 1, name: 'Geography' })
    mockDelete.mockResolvedValue({ id: 1, name: 'Geography' })

    const req = mockReq({
      params: { id: '1' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()
    await deleteCategory(req, res)

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(res.json).toHaveBeenCalledWith({ message: 'Category deleted' })
  })

  it('throws ForbiddenError for non-admin', async () => {
    const req = mockReq({
      params: { id: '1' },
      user: { id: 'user1', pseudo: 'user', email: 'user@test.com', role: 'USER' },
    })
    const res = mockRes()

    await expect(deleteCategory(req, res)).rejects.toThrow(ForbiddenError)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('throws ForbiddenError for QUIZMASTER', async () => {
    const req = mockReq({
      params: { id: '1' },
      user: { id: 'qm1', pseudo: 'qm', email: 'qm@test.com', role: 'QUIZMASTER' },
    })
    const res = mockRes()

    await expect(deleteCategory(req, res)).rejects.toThrow(ForbiddenError)
  })

  it('returns 404 for non-existent category', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({
      params: { id: '999' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()
    await deleteCategory(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 999 } })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Category not found', code: 'NOT_FOUND', status: 404 })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid id', async () => {
    const req = mockReq({
      params: { id: 'abc' },
      user: { id: 'admin1', pseudo: 'admin', email: 'admin@test.com', role: 'QUIZADMIN' },
    })
    const res = mockRes()
    await deleteCategory(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid category ID', code: 'VALIDATION_ERROR', status: 400 })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
