import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppError } from '../types/errors.js'
import logger from '../lib/logger.js'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      status: err.status,
      details: err.details,
    })
    return
  }

  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      status: 400,
      details: err.issues,
    })
    return
  }

  logger.error({ err }, 'Unhandled error')
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  })
}
