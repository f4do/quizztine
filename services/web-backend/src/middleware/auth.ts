import type { Request, Response, NextFunction } from 'express'
import { jwtVerify } from 'jose'
import { config } from '../config/index.js'
import { verifyToken } from '../lib/jwt.js'
import { AuthError, ForbiddenError } from '../types/errors.js'
import type { User } from '../../prisma/generated/prisma/client.js'

export interface AuthenticatedRequest extends Request {
  user?: Pick<User, 'id' | 'pseudo' | 'email' | 'role'>
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError(`Requires one of roles: ${roles.join(', ')}`)
    }
    next()
  }
}

export async function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token
  if (!token) {
    throw new AuthError('No access token provided')
  }

  try {
    const payload = await verifyToken(token)
    req.user = { id: payload.id, pseudo: payload.pseudo, email: payload.email, role: payload.role as User['role'] }
    next()
  } catch {
    throw new AuthError('Invalid or expired access token')
  }
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token
  if (!token) {
    next()
    return
  }

  try {
    const payload = await verifyToken(token)
    req.user = { id: payload.id, pseudo: payload.pseudo, email: payload.email, role: payload.role as User['role'] }
  } catch {
    // silently ignore invalid token for optional auth
  }
  next()
}
