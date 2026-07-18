import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma.js'
import { signAccessToken, signRefreshToken, verifyToken, hashToken } from '../lib/jwt.js'
import { registerSchema, loginSchema } from '../lib/validation.js'
import { config } from '../config/index.js'
import { AppError, AuthError, ValidationError } from '../types/errors.js'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import crypto from 'crypto'

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieBase = {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
  res.cookie('access_token', accessToken, { ...cookieBase, maxAge: 60 * 60 * 1000 })
  res.cookie('refresh_token', refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.revokedToken.create({
    data: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  })
}

async function isTokenRevoked(token: string): Promise<boolean> {
  const revoked = await prisma.revokedToken.findUnique({
    where: { tokenHash: hashToken(token) },
  })
  return revoked !== null
}

export async function register(req: AuthenticatedRequest, res: Response) {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const { pseudo, email, password, confirmPassword: _confirmPassword } = parsed.data

  const existing = await prisma.user.findFirst({
    where: { OR: [{ pseudo }, { email }] },
  })
  if (existing) {
    throw new ValidationError('Pseudo or email already taken')
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const verificationToken = crypto.randomBytes(32).toString('hex')

  const user = await prisma.user.create({
    data: {
      pseudo,
      email,
      password: hashedPassword,
      verificationToken,
    },
  })

  // TODO: send verification email with token link
  console.log(JSON.stringify({ event: 'user-registered', userId: user.id, verificationToken }))

  res.status(201).json({
    message: 'User registered. Check email for verification link.',
  })
}

export async function verifyEmail(req: AuthenticatedRequest, res: Response) {
  const { token } = req.query as { token?: string }
  if (!token) {
    throw new ValidationError('Verification token is required')
  }

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  })
  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired verification token')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
  })

  res.json({ message: 'Email verified successfully' })
}

export async function login(req: AuthenticatedRequest, res: Response) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.issues)
  }

  const { login, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email: login } })
    ?? await prisma.user.findUnique({ where: { pseudo: login } })
  if (!user) {
    throw new AuthError('Invalid email or password')
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw new AuthError('Invalid email or password')
  }

  const tokenPayload = { id: user.id, pseudo: user.pseudo, email: user.email, role: user.role }

  const accessToken = await signAccessToken(tokenPayload)
  const refreshToken = await signRefreshToken(tokenPayload)

  setTokenCookies(res, accessToken, refreshToken)

  res.json({
    user: { id: user.id, pseudo: user.pseudo, email: user.email, role: user.role, language: user.language, theme: user.theme },
  })
}

export async function refresh(req: AuthenticatedRequest, res: Response) {
  const token = req.cookies?.refresh_token
  if (!token) {
    throw new AuthError('No refresh token provided')
  }

  if (await isTokenRevoked(token)) {
    throw new AuthError('Refresh token revoked')
  }

  try {
    const payload = await verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user) {
      throw new AuthError('User not found')
    }

    const tokenPayload = { id: user.id, pseudo: user.pseudo, email: user.email, role: user.role }
    const accessToken = await signAccessToken(tokenPayload)
    const refreshToken = await signRefreshToken(tokenPayload)

    await revokeRefreshToken(token)
    setTokenCookies(res, accessToken, refreshToken)

    res.json({
      user: { id: user.id, pseudo: user.pseudo, email: user.email, role: user.role, language: user.language, theme: user.theme },
    })
  } catch (err) {
    if (err instanceof AuthError) throw err
    throw new AuthError('Invalid refresh token')
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  const token = req.cookies?.refresh_token
  if (token) {
    try {
      await revokeRefreshToken(token)
    } catch {
      // Duplicate or already expired — ignore
    }
  }

  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/' })

  res.json({ message: 'Logged out' })
}

export async function me(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new AuthError()
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) {
    throw new AuthError()
  }

  res.json({
    user: { id: user.id, pseudo: user.pseudo, email: user.email, role: user.role, language: user.language, theme: user.theme },
  })
}

export async function updatePreferences(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    throw new AuthError()
  }

  const { language, theme } = req.body as { language?: string; theme?: string }

  const data: Record<string, string> = {}
  if (language && ['fr', 'en'].includes(language)) data.language = language
  if (theme && ['light', 'dark'].includes(theme)) data.theme = theme

  if (Object.keys(data).length === 0) {
    throw new ValidationError('No valid fields to update')
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
  })

  res.json({
    user: { id: user.id, pseudo: user.pseudo, email: user.email, role: user.role, language: user.language, theme: user.theme },
  })
}
