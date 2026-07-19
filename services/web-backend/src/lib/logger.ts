import pino from 'pino'
import { config } from '../config/index.js'

function createLogger() {
  const opts: pino.LoggerOptions = {
    level: config.logLevel ?? 'info',
    redact: ['req.headers.cookie', 'req.headers.authorization'],
  }

  // pino-pretty transport is optional — fall back to JSON if unavailable
  if (config.nodeEnv === 'development') {
    try {
      opts.transport = { target: 'pino-pretty' }
    } catch {
      // pino-pretty not installed, use default JSON output
    }
  }

  return pino(opts)
}

const logger = createLogger()

export default logger
