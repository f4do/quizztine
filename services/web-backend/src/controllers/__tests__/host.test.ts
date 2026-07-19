import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listHosts, getActiveHost, getHost, createHost, updateHost, deleteHost } from '../host.js'
import { mockReq, mockRes } from '../../test/utils.js'
import { AppError } from '../../types/errors.js'

const { mockFindMany, mockFindUnique, mockFindFirst, mockCreate, mockUpdate, mockUpdateMany, mockDelete, mockTransaction } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    host: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      delete: mockDelete,
    },
    $transaction: mockTransaction,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const christineConfig = {
  topType: 'LongHairStraight2',
  hairColor: 'Red',
  accessoriesType: 'Blank',
  facialHairType: 'Blank',
  facialHairColor: 'Blank',
  clotheType: 'ShirtVNeck',
  clotheColor: 'Pink',
  skinColor: 'Brown',
}

const mockHosts = [
  { id: '1', name: 'Christine', avatarType: 'BUILTIN', avatarConfig: christineConfig, avatarUrl: null, isActive: true, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: '2', name: 'Alex', avatarType: 'UPLOAD', avatarConfig: null, avatarUrl: '/uploads/host2.png', isActive: false, createdAt: new Date('2025-02-01'), updatedAt: new Date('2025-02-01') },
]

describe('listHosts', () => {
  it('returns all hosts ordered by createdAt asc', async () => {
    mockFindMany.mockResolvedValue(mockHosts)

    const req = mockReq()
    const res = mockRes()
    await listHosts(req, res)

    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } })
    expect(res.json).toHaveBeenCalledWith({ hosts: mockHosts })
  })

  it('returns empty array when no hosts', async () => {
    mockFindMany.mockResolvedValue([])

    const req = mockReq()
    const res = mockRes()
    await listHosts(req, res)

    expect(res.json).toHaveBeenCalledWith({ hosts: [] })
  })
})

describe('getActiveHost', () => {
  it('returns the active host', async () => {
    const activeHost = mockHosts[0]
    mockFindFirst.mockResolvedValue(activeHost)

    const req = mockReq()
    const res = mockRes()
    await getActiveHost(req, res)

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { isActive: true } })
    expect(res.json).toHaveBeenCalledWith({ host: activeHost })
  })

  it('falls back to default host object when no host is active', async () => {
    mockFindFirst.mockResolvedValue(null)

    const req = mockReq()
    const res = mockRes()
    await getActiveHost(req, res)

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { isActive: true } })
    expect(res.json).toHaveBeenCalledWith({
      host: {
        id: 'default-host',
        name: 'Christine',
        avatarType: 'BUILTIN',
        avatarConfig: christineConfig,
        avatarUrl: null,
      },
    })
  })
})

describe('getHost', () => {
  it('returns host by id', async () => {
    const host = mockHosts[0]
    mockFindUnique.mockResolvedValue(host)

    const req = mockReq({ params: { id: '1' } })
    const res = mockRes()
    await getHost(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '1' } })
    expect(res.json).toHaveBeenCalledWith({ host })
  })

  it('throws 404 when host not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'nonexistent' } })
    const res = mockRes()

    await expect(getHost(req, res)).rejects.toThrow(new AppError(404, 'HOST_NOT_FOUND', 'Host not found'))
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'nonexistent' } })
  })
})

describe('createHost', () => {
  it('creates host with valid data', async () => {
    const createdHost = { id: '3', name: 'New Host', avatarType: 'BUILTIN', avatarConfig: null, avatarUrl: null, isActive: false }
    mockCreate.mockResolvedValue(createdHost)

    const req = mockReq({ body: { name: 'New Host' } })
    const res = mockRes()
    await createHost(req, res)

    expect(mockCreate).toHaveBeenCalledWith({
      data: { name: 'New Host', avatarType: 'BUILTIN' },
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ host: createdHost })
  })

  it('uses provided avatarType, avatarConfig, and avatarUrl', async () => {
    const createdHost = { id: '4', name: 'Custom', avatarType: 'URL', avatarConfig: null, avatarUrl: 'https://example.com/avatar.png', isActive: false }
    mockCreate.mockResolvedValue(createdHost)

    const req = mockReq({
      body: {
        name: 'Custom',
        avatarType: 'URL',
        avatarConfig: { topType: 'ShortHairShortWaved', hairColor: 'SilverGray' },
        avatarUrl: 'https://example.com/avatar.png',
      },
    })
    const res = mockRes()
    await createHost(req, res)

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'Custom',
        avatarType: 'URL',
        avatarConfig: { topType: 'ShortHairShortWaved', hairColor: 'SilverGray' },
        avatarUrl: 'https://example.com/avatar.png',
      },
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ host: createdHost })
  })

  it('throws validation error when name is missing', async () => {
    const req = mockReq({ body: {} })
    const res = mockRes()

    await expect(createHost(req, res)).rejects.toThrow()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws validation error when name is empty string', async () => {
    const req = mockReq({ body: { name: '' } })
    const res = mockRes()

    await expect(createHost(req, res)).rejects.toThrow()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws validation error when name exceeds max length', async () => {
    const req = mockReq({ body: { name: 'a'.repeat(101) } })
    const res = mockRes()

    await expect(createHost(req, res)).rejects.toThrow()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws validation error for invalid avatarType', async () => {
    const req = mockReq({ body: { name: 'Host', avatarType: 'INVALID' } })
    const res = mockRes()

    await expect(createHost(req, res)).rejects.toThrow()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('updateHost', () => {
  const existingHost = {
    id: '1',
    name: 'Christine',
    avatarType: 'BUILTIN',
    avatarConfig: christineConfig,
    avatarUrl: null,
    isActive: false,
  }

  it('updates host fields (partial update)', async () => {
    mockFindUnique.mockResolvedValue(existingHost)
    const updatedHost = { ...existingHost, name: 'Updated', avatarConfig: { topType: 'ShortHairShortWaved' } }
    mockUpdate.mockReturnValue(updatedHost)
    mockTransaction.mockResolvedValue([updatedHost])

    const req = mockReq({
      params: { id: '1' },
      body: { name: 'Updated', avatarConfig: { topType: 'ShortHairShortWaved' } },
    })
    const res = mockRes()
    await updateHost(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '1' } })
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: '1' }, data: { name: 'Updated', avatarConfig: { topType: 'ShortHairShortWaved' } } })
    expect(mockTransaction).toHaveBeenCalledWith([updatedHost])
    expect(res.json).toHaveBeenCalledWith({ host: updatedHost })
  })

  it('updates host and activates it (deactivates others)', async () => {
    mockFindUnique.mockResolvedValue(existingHost)
    const updatedHost = { ...existingHost, name: 'Christine', isActive: true }
    const updateManyResult = { count: 1 }
    mockUpdateMany.mockReturnValue(updateManyResult)
    mockUpdate.mockReturnValue(updatedHost)
    mockTransaction.mockResolvedValue([updateManyResult, updatedHost])

    const req = mockReq({
      params: { id: '1' },
      body: { isActive: true },
    })
    const res = mockRes()
    await updateHost(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '1' } })
    expect(mockUpdateMany).toHaveBeenCalledWith({ where: { isActive: true, NOT: { id: '1' } }, data: { isActive: false } })
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: '1' }, data: { isActive: true } })
    expect(mockTransaction).toHaveBeenCalledWith([updateManyResult, updatedHost])
    expect(res.json).toHaveBeenCalledWith({ host: updatedHost })
  })

  it('throws 404 when host not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({
      params: { id: 'nonexistent' },
      body: { name: 'Updated' },
    })
    const res = mockRes()

    await expect(updateHost(req, res)).rejects.toThrow(new AppError(404, 'HOST_NOT_FOUND', 'Host not found'))
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'nonexistent' } })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('throws validation error for invalid avatarType', async () => {
    mockFindUnique.mockResolvedValue(existingHost)

    const req = mockReq({
      params: { id: '1' },
      body: { avatarType: 'INVALID' },
    })
    const res = mockRes()

    await expect(updateHost(req, res)).rejects.toThrow()
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

describe('deleteHost', () => {
  it('deletes a non-active host', async () => {
    const host = { id: '2', name: 'Alex', isActive: false }
    mockFindUnique.mockResolvedValue(host)
    mockDelete.mockResolvedValue(host)

    const req = mockReq({ params: { id: '2' } })
    const res = mockRes()
    await deleteHost(req, res)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '2' } })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: '2' } })
    expect(res.json).toHaveBeenCalledWith({ message: 'Host deleted' })
  })

  it('throws 400 when trying to delete active host', async () => {
    const host = { id: '1', name: 'Christine', isActive: true }
    mockFindUnique.mockResolvedValue(host)

    const req = mockReq({ params: { id: '1' } })
    const res = mockRes()

    await expect(deleteHost(req, res)).rejects.toThrow(new AppError(400, 'CANNOT_DELETE_ACTIVE_HOST', 'Cannot delete the active host. Activate another host first.'))
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: '1' } })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('throws 404 when host not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'nonexistent' } })
    const res = mockRes()

    await expect(deleteHost(req, res)).rejects.toThrow(new AppError(404, 'HOST_NOT_FOUND', 'Host not found'))
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'nonexistent' } })
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
