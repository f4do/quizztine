import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listHosts, getActiveHost, getHost, createHost, updateHost, deleteHost, fetchAvatar, listPhrases, getPhraseContexts, getRandomPhrase, createPhrase, updatePhrase, deletePhrase } from '../host.js'
import { mockReq, mockRes } from '../../test/utils.js'
import crypto from 'crypto'
import { AppError } from '../../types/errors.js'

const { mockFindMany, mockFindUnique, mockFindFirst, mockCreate, mockUpdate, mockUpdateMany, mockDelete, mockTransaction, mockHostPhraseFindMany, mockHostPhraseFindUnique, mockHostPhraseFindFirst, mockHostPhraseCreate, mockHostPhraseUpdate, mockHostPhraseDelete } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
  mockHostPhraseFindMany: vi.fn(),
  mockHostPhraseFindUnique: vi.fn(),
  mockHostPhraseFindFirst: vi.fn(),
  mockHostPhraseCreate: vi.fn(),
  mockHostPhraseUpdate: vi.fn(),
  mockHostPhraseDelete: vi.fn(),
}))

const { mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
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
    hostPhrase: {
      findMany: mockHostPhraseFindMany,
      findUnique: mockHostPhraseFindUnique,
      findFirst: mockHostPhraseFindFirst,
      create: mockHostPhraseCreate,
      update: mockHostPhraseUpdate,
      delete: mockHostPhraseDelete,
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

const mockPhrases = [
  { id: 'p1', context: 'feedback.correct', scope: 'game', lang: 'fr', text: 'Bien joué !', priority: 50, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'p2', context: 'feedback.correct', scope: 'game', lang: 'en', text: 'Well done!', priority: 50, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'p3', context: 'pre.solo', scope: 'game', lang: 'fr', text: 'Prêt pour le solo ?', priority: 50, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
]

describe('listPhrases', () => {
  it('returns all phrases without filters', async () => {
    mockHostPhraseFindMany.mockResolvedValue(mockPhrases)

    const req = mockReq()
    const res = mockRes()
    await listPhrases(req, res)

    expect(mockHostPhraseFindMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [{ context: 'asc' }, { priority: 'desc' }],
    })
    expect(res.json).toHaveBeenCalledWith({ phrases: mockPhrases })
  })

  it('filters by context, lang, scope', async () => {
    mockHostPhraseFindMany.mockResolvedValue([mockPhrases[0]])

    const req = mockReq({ query: { context: 'feedback.correct', lang: 'fr', scope: 'game' } })
    const res = mockRes()
    await listPhrases(req, res)

    expect(mockHostPhraseFindMany).toHaveBeenCalledWith({
      where: { context: 'feedback.correct', lang: 'fr', scope: 'game' },
      orderBy: [{ context: 'asc' }, { priority: 'desc' }],
    })
    expect(res.json).toHaveBeenCalledWith({ phrases: [mockPhrases[0]] })
  })

  it('returns empty array when no phrases match', async () => {
    mockHostPhraseFindMany.mockResolvedValue([])

    const req = mockReq({ query: { context: 'nonexistent' } })
    const res = mockRes()
    await listPhrases(req, res)

    expect(res.json).toHaveBeenCalledWith({ phrases: [] })
  })
})

describe('getPhraseContexts', () => {
  it('returns all context groups and variables', async () => {
    const req = mockReq()
    const res = mockRes()
    await getPhraseContexts(req, res)

    const result = res.json.mock.calls[0][0]
    expect(result.contexts).toBeDefined()
    expect(result.variables).toBeDefined()
    expect(result.contexts.pre).toContain('pre.solo')
    expect(result.contexts.feedback).toContain('feedback.correct')
    expect(result.contexts.game).toContain('question.default')
    expect(result.contexts.end).toContain('end.winner')
    expect(result.contexts.site).toContain('home.welcome')
    const allContexts = Object.values(result.contexts as Record<string, string[]>).flat()
    expect(allContexts).toHaveLength(50)
    // Verify a few variables
    expect(result.variables['question.default']).toEqual(['index', 'total', 'category'])
    expect(result.variables['end.winner']).toEqual(['pseudo', 'score', 'total', 'correct_count', 'rank'])
    expect(result.variables['profile.prompt']).toEqual(['pseudo'])
    expect(result.variables['site.room_created']).toEqual(['code'])
  })
})

describe('getRandomPhrase', () => {
  it('returns a random phrase for matching context and lang', async () => {
    const frPhrases = mockPhrases.filter(p => p.context === 'feedback.correct' && p.lang === 'fr')
    mockHostPhraseFindMany.mockResolvedValue(frPhrases)

    const req = mockReq({ query: { context: 'feedback.correct', lang: 'fr' } })
    const res = mockRes()
    await getRandomPhrase(req, res)

    expect(mockHostPhraseFindMany).toHaveBeenCalledWith({
      where: { context: 'feedback.correct', lang: 'fr' },
    })
    expect(res.json).toHaveBeenCalledWith({
      phrase: { id: 'p1', context: 'feedback.correct', text: 'Bien joué !', lang: 'fr' },
    })
  })

  it('defaults to fr lang when not provided', async () => {
    mockHostPhraseFindMany.mockResolvedValue([mockPhrases[0]])

    const req = mockReq({ query: { context: 'feedback.correct' } })
    const res = mockRes()
    await getRandomPhrase(req, res)

    expect(mockHostPhraseFindMany).toHaveBeenCalledWith({
      where: { context: 'feedback.correct', lang: 'fr' },
    })
  })

  it('throws 404 when no phrase found', async () => {
    mockHostPhraseFindMany.mockResolvedValue([])

    const req = mockReq({ query: { context: 'feedback.correct', lang: 'en' } })
    const res = mockRes()

    await expect(getRandomPhrase(req, res)).rejects.toThrow(
      new AppError(404, 'PHRASE_NOT_FOUND', 'No phrase found for this context and language'),
    )
  })

  it('throws 400 when context is missing', async () => {
    const req = mockReq({ query: {} })
    const res = mockRes()

    await expect(getRandomPhrase(req, res)).rejects.toThrow(
      new AppError(400, 'VALIDATION_ERROR', 'context query parameter is required'),
    )
  })

  it('returns different phrases over time when multiple exist', async () => {
    const multiPhrases = [
      { id: 'a', context: 'pre.solo', scope: 'game', lang: 'fr', text: 'Phrase A', priority: 50, createdAt: new Date(), updatedAt: new Date() },
      { id: 'b', context: 'pre.solo', scope: 'game', lang: 'fr', text: 'Phrase B', priority: 50, createdAt: new Date(), updatedAt: new Date() },
    ]
    mockHostPhraseFindMany.mockResolvedValue(multiPhrases)

    // Run multiple times and collect results — more than one distinct result over many runs proves randomness
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const req = mockReq({ query: { context: 'pre.solo', lang: 'fr' } })
      const res = mockRes()
      await getRandomPhrase(req, res)
      const phraseId = res.json.mock.calls[0][0].phrase.id
      results.add(phraseId)
    }

    // With 2 phrases and 20 runs, we should see both at least once (prob of missing one: 2 * (1/2)^20 ≈ 0.000002)
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('createPhrase', () => {
  it('creates a phrase with valid data', async () => {
    const created = { id: 'new1', context: 'feedback.correct', scope: 'game', lang: 'fr', text: 'Bravo !', priority: 50, createdAt: new Date(), updatedAt: new Date() }
    mockHostPhraseCreate.mockResolvedValue(created)

    const req = mockReq({ body: { context: 'feedback.correct', lang: 'fr', text: 'Bravo !' } })
    const res = mockRes()
    await createPhrase(req, res)

    expect(mockHostPhraseCreate).toHaveBeenCalledWith({
      data: { context: 'feedback.correct', lang: 'fr', text: 'Bravo !' },
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ phrase: created })
  })

  it('accepts optional priority, scope', async () => {
    const created = { id: 'new2', context: 'pre.solo', scope: 'site', lang: 'en', text: 'Ready?', priority: 80, createdAt: new Date(), updatedAt: new Date() }
    mockHostPhraseCreate.mockResolvedValue(created)

    const req = mockReq({
      body: { context: 'pre.solo', lang: 'en', text: 'Ready?', priority: 80, scope: 'site' },
    })
    const res = mockRes()
    await createPhrase(req, res)

    expect(mockHostPhraseCreate).toHaveBeenCalledWith({
      data: { context: 'pre.solo', lang: 'en', text: 'Ready?', priority: 80, scope: 'site' },
    })
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('rejects empty context', async () => {
    const req = mockReq({ body: { context: '', lang: 'fr', text: 'Bonjour' } })
    const res = mockRes()
    await expect(createPhrase(req, res)).rejects.toThrow()
    expect(mockHostPhraseCreate).not.toHaveBeenCalled()
  })

  it('rejects invalid lang', async () => {
    const req = mockReq({ body: { context: 'pre.solo', lang: 'de', text: 'Hallo' } })
    const res = mockRes()
    await expect(createPhrase(req, res)).rejects.toThrow()
    expect(mockHostPhraseCreate).not.toHaveBeenCalled()
  })

  it('rejects empty text', async () => {
    const req = mockReq({ body: { context: 'pre.solo', lang: 'fr', text: '' } })
    const res = mockRes()
    await expect(createPhrase(req, res)).rejects.toThrow()
    expect(mockHostPhraseCreate).not.toHaveBeenCalled()
  })
})

describe('updatePhrase', () => {
  const existing = { id: 'p1', context: 'feedback.correct', scope: 'game', lang: 'fr', text: 'Bien joué !', priority: 50, createdAt: new Date(), updatedAt: new Date() }

  it('updates phrase fields (partial)', async () => {
    mockHostPhraseFindUnique.mockResolvedValue(existing)
    const updated = { ...existing, text: 'Super !' }
    mockHostPhraseUpdate.mockResolvedValue(updated)

    const req = mockReq({ params: { id: 'p1' }, body: { text: 'Super !' } })
    const res = mockRes()
    await updatePhrase(req, res)

    expect(mockHostPhraseFindUnique).toHaveBeenCalledWith({ where: { id: 'p1' } })
    expect(mockHostPhraseUpdate).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { text: 'Super !' } })
    expect(res.json).toHaveBeenCalledWith({ phrase: updated })
  })

  it('throws 404 when phrase not found', async () => {
    mockHostPhraseFindUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'nonexistent' }, body: { text: 'Bonjour' } })
    const res = mockRes()

    await expect(updatePhrase(req, res)).rejects.toThrow(
      new AppError(404, 'PHRASE_NOT_FOUND', 'Phrase not found'),
    )
    expect(mockHostPhraseUpdate).not.toHaveBeenCalled()
  })

  it('rejects invalid scope', async () => {
    mockHostPhraseFindUnique.mockResolvedValue(existing)

    const req = mockReq({ params: { id: 'p1' }, body: { scope: 'invalid' } })
    const res = mockRes()

    await expect(updatePhrase(req, res)).rejects.toThrow()
    expect(mockHostPhraseUpdate).not.toHaveBeenCalled()
  })
})

describe('deletePhrase', () => {
  const existing = { id: 'p1', context: 'feedback.correct', scope: 'game', lang: 'fr', text: 'Bien joué !', priority: 50, createdAt: new Date(), updatedAt: new Date() }

  it('deletes an existing phrase', async () => {
    mockHostPhraseFindUnique.mockResolvedValue(existing)
    mockHostPhraseDelete.mockResolvedValue(existing)

    const req = mockReq({ params: { id: 'p1' } })
    const res = mockRes()
    await deletePhrase(req, res)

    expect(mockHostPhraseFindUnique).toHaveBeenCalledWith({ where: { id: 'p1' } })
    expect(mockHostPhraseDelete).toHaveBeenCalledWith({ where: { id: 'p1' } })
    expect(res.json).toHaveBeenCalledWith({ message: 'Phrase deleted' })
  })

  it('throws 404 when phrase not found', async () => {
    mockHostPhraseFindUnique.mockResolvedValue(null)

    const req = mockReq({ params: { id: 'nonexistent' } })
    const res = mockRes()

    await expect(deletePhrase(req, res)).rejects.toThrow(
      new AppError(404, 'PHRASE_NOT_FOUND', 'Phrase not found'),
    )
    expect(mockHostPhraseDelete).not.toHaveBeenCalled()
  })
})

describe('fetchAvatar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid')
  })

  describe('SSRF protection', () => {
    it('rejects request to 127.0.0.1', async () => {
      const req = mockReq({ body: { url: 'http://127.0.0.1/admin' } })
      const res = mockRes()

      await expect(fetchAvatar(req, res)).rejects.toThrow(
        new AppError(400, 'SSRF_BLOCKED', 'URL points to a private or reserved address'),
      )
    })

    it('rejects request to localhost', async () => {
      const req = mockReq({ body: { url: 'http://localhost:8080' } })
      const res = mockRes()

      await expect(fetchAvatar(req, res)).rejects.toThrow(
        new AppError(400, 'SSRF_BLOCKED', 'URL points to a private or reserved address'),
      )
    })

    it('rejects request to 192.168.x.x address', async () => {
      const req = mockReq({ body: { url: 'http://192.168.1.1' } })
      const res = mockRes()

      await expect(fetchAvatar(req, res)).rejects.toThrow(
        new AppError(400, 'SSRF_BLOCKED', 'URL points to a private or reserved address'),
      )
    })
  })

  describe('URL validation', () => {
    it('rejects non-URL string', async () => {
      const req = mockReq({ body: { url: 'not-a-url' } })
      const res = mockRes()

      await expect(fetchAvatar(req, res)).rejects.toThrow()
    })

    it('rejects empty body', async () => {
      const req = mockReq({ body: {} })
      const res = mockRes()

      await expect(fetchAvatar(req, res)).rejects.toThrow()
    })
  })

  describe('download failure', () => {
    it('throws DOWNLOAD_FAILED when fetch returns non-ok status', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Map(),
        arrayBuffer: vi.fn(),
      } as unknown as Response)

      const req = mockReq({ body: { url: 'https://example.com/avatar.png' } })
      const res = mockRes()

      await expect(fetchAvatar(req, res)).rejects.toThrow(
        new AppError(400, 'DOWNLOAD_FAILED', 'Failed to download image: 404'),
      )
    })
  })

  describe('happy path', () => {
    it('downloads image and returns avatar URL', async () => {
      const imageBuffer = Buffer.from('fake-image-data')
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
      } as unknown as Response)

      const req = mockReq({ body: { url: 'https://example.com/avatar.png' } })
      const res = mockRes()

      await fetchAvatar(req, res)

      expect(mockMkdir).toHaveBeenCalledWith('uploads', { recursive: true })
      expect(mockWriteFile).toHaveBeenCalledWith(
        'uploads/mock-uuid.png',
        expect.any(Buffer),
      )
      expect(res.json).toHaveBeenCalledWith({
        avatarUrl: '/uploads/mock-uuid.png',
      })
    })
  })
})
