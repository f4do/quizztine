import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { config } from '../config/index.js'

interface TokenPayload {
  id: string
  pseudo: string
  email: string
  role: string
}

function getSecretKey(): Uint8Array {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return new TextEncoder().encode(config.jwtSecret)
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(getSecretKey())
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecretKey())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey())
  return payload as unknown as TokenPayload
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
