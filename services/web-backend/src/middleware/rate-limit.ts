import rateLimit from 'express-rate-limit'

/**
 * Auth limiter: 10 requests per 15 minutes per IP.
 * Applied to /auth/login and /auth/register to mitigate brute-force attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    details: 'Too many authentication attempts. Please try again later.',
  },
})

/**
 * Global limiter: 100 requests per 15 minutes per IP.
 * Optional — can be applied to the entire API as a safety net.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    details: 'Too many requests. Please slow down.',
  },
})
