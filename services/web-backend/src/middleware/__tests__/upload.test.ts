import { describe, it, expect, vi } from 'vitest'

// Mock fs to avoid creating actual directories during import
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}))

// Mock config to avoid dotenv and provide a stable uploadDir
vi.mock('../../config/index.js', () => ({
  config: {
    uploadDir: '/tmp/quizztine-test-uploads',
  },
}))

// Mock uuid to return a predictable value
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}))

import { upload } from '../upload.js'

describe('upload middleware', () => {
  it('is a multer instance with expected methods', () => {
    expect(upload).toBeDefined()
    expect(typeof upload.single).toBe('function')
    expect(typeof upload.array).toBe('function')
    expect(typeof upload.fields).toBe('function')
    expect(typeof upload.none).toBe('function')
    expect(typeof upload.any).toBe('function')
  })
})
