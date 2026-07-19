import 'dotenv/config'

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/quizztine',
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessExpiresIn: '1h',
  jwtRefreshExpiresIn: '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  quizEngineUrl: process.env.QUIZ_ENGINE_URL ?? 'http://localhost:8000',
  engineTimeout: Number(process.env.ENGINE_TIMEOUT) || 5000,
}

if (config.nodeEnv === 'production' && !config.jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production')
}
