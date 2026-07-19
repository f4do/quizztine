import { createServer } from 'http'
import app from './app.js'
import { config } from './config/index.js'
import { prisma } from './lib/prisma.js'
import { initSocket, getIO } from './lib/socket.js'
import logger from './lib/logger.js'

const httpServer = createServer(app)
const io = initSocket(httpServer)

// Purge expired revoked tokens every hour
const purgeInterval = setInterval(async () => {
  try {
    const result = await prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    if (result.count > 0) {
      logger.info({ event: 'purge-revoked-tokens', count: result.count }, 'Purged expired revoked tokens')
    }
  } catch (err) {
    logger.error({ event: 'purge-revoked-tokens-error', err }, 'Failed to purge expired revoked tokens')
  }
}, 60 * 60 * 1000)

httpServer.listen(config.port, () => {
  logger.info({ event: 'server-start', port: config.port }, 'Server started')
})

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown')

  // 1. Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed')
  })

  // 2. Disconnect Socket.IO
  try {
    io.close()
    logger.info('Socket.IO disconnected')
  } catch (err) {
    logger.error({ err }, 'Error disconnecting Socket.IO')
  }

  // 3. Clear the revoked-token purge interval
  clearInterval(purgeInterval)
  logger.info('Purge interval cleared')

  // 4. Disconnect Prisma
  prisma.$disconnect().then(() => {
    logger.info('Prisma disconnected')
    process.exit(0)
  }).catch((err) => {
    logger.error({ err }, 'Error disconnecting Prisma')
    process.exit(1)
  })
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

export default httpServer
