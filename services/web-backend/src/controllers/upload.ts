import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { ValidationError } from '../types/errors.js'
import { config } from '../config/index.js'
import path from 'path'
import fs from 'fs'

const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_AUDIO_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function uploadFile(req: AuthenticatedRequest, res: Response) {
  if (!req.file) {
    throw new ValidationError('No file provided')
  }

  const file = req.file
  const isAudio = ALLOWED_AUDIO_TYPES.includes(file.mimetype)
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype)

  if (!isAudio && !isImage) {
    fs.unlinkSync(file.path)
    throw new ValidationError('Invalid file type. Allowed: audio (webm, ogg, mp3, wav) and images (jpeg, png, gif, webp)')
  }

  if (isAudio && file.size > MAX_AUDIO_SIZE) {
    fs.unlinkSync(file.path)
    throw new ValidationError('Audio file too large. Max 5 MB')
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    fs.unlinkSync(file.path)
    throw new ValidationError('Image file too large. Max 10 MB')
  }

  const mediaType = isAudio ? 'audio' : 'image'
  const url = `/uploads/${file.filename}`

  res.json({ url, mediaType, filename: file.filename })
}
