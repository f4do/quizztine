import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { config } from '../config/index.js'
import { AppError } from '../types/errors.js'

const uploadDir = path.resolve(config.uploadDir)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.wav', '.ogg']

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    // UUID-based filename prevents path traversal attacks
    const ext = path.extname(file.originalname)
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new AppError(400, 'INVALID_FILE_TYPE', `File type ${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`))
  }
  cb(null, true)
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }) // 10 MB max
