import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import { uploadFile } from '../upload.js'
import { ValidationError } from '../../types/errors.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'

const { mockUnlinkSync } = vi.hoisted(() => ({
  mockUnlinkSync: vi.fn(),
}))

vi.mock('fs', () => ({
  default: { unlinkSync: mockUnlinkSync },
  unlinkSync: mockUnlinkSync,
}))

function mockReq(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    body: {},
    user: undefined,
    params: {},
    query: {},
    cookies: {},
    file: undefined,
    ...overrides,
  } as unknown as AuthenticatedRequest
}

function mockRes(): Response {
  const res: Record<string, unknown> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

function createMockFile(overrides: Record<string, unknown> = {}) {
  return {
    fieldname: 'file',
    originalname: 'test-file',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    destination: '/tmp/uploads',
    filename: 'abc123-test.jpg',
    path: '/tmp/uploads/abc123-test.jpg',
    size: 1024 * 1024, // 1 MB
    ...overrides,
  }
}

describe('uploadFile', () => {
  it('throws ValidationError when no file provided', async () => {
    const req = mockReq()
    const res = mockRes()

    await expect(uploadFile(req, res)).rejects.toThrow(ValidationError)
    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })

  it('accepts valid audio file', async () => {
    const file = createMockFile({
      mimetype: 'audio/webm',
      originalname: 'recording.webm',
      filename: 'uuid-audio.webm',
      path: '/tmp/uploads/uuid-audio.webm',
      size: 2 * 1024 * 1024, // 2 MB
    })
    const req = mockReq({ file })
    const res = mockRes()
    await uploadFile(req, res)

    expect(mockUnlinkSync).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      url: '/uploads/uuid-audio.webm',
      mediaType: 'audio',
      filename: 'uuid-audio.webm',
    })
  })

  it('accepts valid image file', async () => {
    const file = createMockFile({
      mimetype: 'image/jpeg',
      originalname: 'photo.jpg',
      filename: 'uuid-image.jpg',
      path: '/tmp/uploads/uuid-image.jpg',
      size: 5 * 1024 * 1024, // 5 MB
    })
    const req = mockReq({ file })
    const res = mockRes()
    await uploadFile(req, res)

    expect(mockUnlinkSync).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      url: '/uploads/uuid-image.jpg',
      mediaType: 'image',
      filename: 'uuid-image.jpg',
    })
  })

  it('accepts audio/mpeg as valid audio type', async () => {
    const file = createMockFile({
      mimetype: 'audio/mpeg',
      originalname: 'song.mp3',
      filename: 'uuid-song.mp3',
      path: '/tmp/uploads/uuid-song.mp3',
      size: 1 * 1024 * 1024,
    })
    const req = mockReq({ file })
    const res = mockRes()
    await uploadFile(req, res)

    expect(res.json).toHaveBeenCalledWith({
      url: '/uploads/uuid-song.mp3',
      mediaType: 'audio',
      filename: 'uuid-song.mp3',
    })
  })

  it('accepts valid png image', async () => {
    const file = createMockFile({
      mimetype: 'image/png',
      filename: 'uuid-image.png',
      path: '/tmp/uploads/uuid-image.png',
      size: 3 * 1024 * 1024,
    })
    const req = mockReq({ file })
    const res = mockRes()
    await uploadFile(req, res)

    expect(res.json).toHaveBeenCalledWith({
      url: '/uploads/uuid-image.png',
      mediaType: 'image',
      filename: 'uuid-image.png',
    })
  })

  it('throws ValidationError for invalid file type', async () => {
    const file = createMockFile({
      mimetype: 'application/pdf',
      originalname: 'doc.pdf',
      filename: 'uuid-doc.pdf',
      path: '/tmp/uploads/uuid-doc.pdf',
    })
    const req = mockReq({ file })
    const res = mockRes()

    await expect(uploadFile(req, res)).rejects.toThrow(ValidationError)
    expect(mockUnlinkSync).toHaveBeenCalledWith(file.path)
  })

  it('throws ValidationError for audio too large (>5MB)', async () => {
    const file = createMockFile({
      mimetype: 'audio/webm',
      size: 6 * 1024 * 1024, // 6 MB (> 5 MB limit)
      path: '/tmp/uploads/uuid-large-audio.webm',
    })
    const req = mockReq({ file })
    const res = mockRes()

    await expect(uploadFile(req, res)).rejects.toThrow(ValidationError)
    expect(mockUnlinkSync).toHaveBeenCalledWith(file.path)
  })

  it('throws ValidationError for image too large (>10MB)', async () => {
    const file = createMockFile({
      mimetype: 'image/jpeg',
      size: 11 * 1024 * 1024, // 11 MB (> 10 MB limit)
      path: '/tmp/uploads/uuid-large-image.jpg',
    })
    const req = mockReq({ file })
    const res = mockRes()

    await expect(uploadFile(req, res)).rejects.toThrow(ValidationError)
    expect(mockUnlinkSync).toHaveBeenCalledWith(file.path)
  })

  it('accepts audio file at exactly 5MB limit', async () => {
    const file = createMockFile({
      mimetype: 'audio/ogg',
      size: 5 * 1024 * 1024, // exactly 5 MB
      path: '/tmp/uploads/uuid-limit-audio.ogg',
      filename: 'uuid-limit-audio.ogg',
    })
    const req = mockReq({ file })
    const res = mockRes()
    await uploadFile(req, res)

    expect(mockUnlinkSync).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      url: '/uploads/uuid-limit-audio.ogg',
      mediaType: 'audio',
      filename: 'uuid-limit-audio.ogg',
    })
  })

  it('accepts image file at exactly 10MB limit', async () => {
    const file = createMockFile({
      mimetype: 'image/gif',
      size: 10 * 1024 * 1024, // exactly 10 MB
      path: '/tmp/uploads/uuid-limit-image.gif',
      filename: 'uuid-limit-image.gif',
    })
    const req = mockReq({ file })
    const res = mockRes()
    await uploadFile(req, res)

    expect(mockUnlinkSync).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({
      url: '/uploads/uuid-limit-image.gif',
      mediaType: 'image',
      filename: 'uuid-limit-image.gif',
    })
  })
})
