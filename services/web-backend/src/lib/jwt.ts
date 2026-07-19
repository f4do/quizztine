import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { config } from '../config/index.js'

const TokenPayloadSchema = z.object({
  id: z.string(),
  pseudo: z.string(),
  email: z.string(),
  role: z.string(),
})
type TokenPayload = z.infer<typeof TokenPayloadSchema>

function getSecretKey(): Uint8Array {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return new TextEncoder().encode(config.jwtSecret)
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(getSecretKey())
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecretKey())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey())
  const result = TokenPayloadSchema.safeParse(payload)
  if (!result.success) {
    throw new Error('Invalid token payload')
  }
  return result.data
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
