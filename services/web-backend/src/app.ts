import express, { type Express } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { config } from './config/index.js'
import logger from './lib/logger.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import questionRouter from './routes/questions.js'
import uploadRouter from './routes/upload.js'
import roomRouter from './routes/rooms.js'
import reportRouter from './routes/reports.js'
import categoryRouter from './routes/categories.js'
import userRouter from './routes/users.js'
import { globalLimiter } from './middleware/rate-limit.js'
import { errorHandler } from './middleware/error-handler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app: Express = express()

app.use(cors({ origin: config.corsOrigin, credentials: true }))
app.use(pinoHttp({ logger }))
app.use(express.json())
app.use(cookieParser())

app.use(healthRouter)
// app.use(globalLimiter) // Optional: uncomment to apply 100 req/15min globally
app.use(authRouter)
app.use(questionRouter)
app.use(uploadRouter)
app.use(roomRouter)
app.use(reportRouter)
app.use(categoryRouter)
app.use(userRouter)
app.use('/uploads', express.static(config.uploadDir))

// Serve built frontend (monoconteneur — production only)
const frontendDist = path.resolve(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))

// SPA fallback: let React Router handle all non-API routes
// Use Accept header to distinguish browser navigation (text/html) from API calls (application/json)
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html')) return next()
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next()
  })
})

app.use(errorHandler)

export default app
