import express, { type Express } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { config } from './config/index.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import questionRouter from './routes/questions.js'
import uploadRouter from './routes/upload.js'
import roomRouter from './routes/rooms.js'
import reportRouter from './routes/reports.js'
import categoryRouter from './routes/categories.js'
import userRouter from './routes/users.js'
import { authLimiter, globalLimiter } from './middleware/rate-limit.js'
import { errorHandler } from './middleware/error-handler.js'

const app: Express = express()

app.use(cors({ origin: config.corsOrigin, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use(healthRouter)
app.use('/auth', authLimiter)
// app.use(globalLimiter) // Optional: uncomment to apply 100 req/15min globally
app.use(authRouter)
app.use(questionRouter)
app.use(uploadRouter)
app.use(roomRouter)
app.use(reportRouter)
app.use(categoryRouter)
app.use(userRouter)
app.use('/uploads', express.static(config.uploadDir))

app.use(errorHandler)

export default app
