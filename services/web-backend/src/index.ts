import { createServer } from 'http'
import app from './app.js'
import { config } from './config/index.js'
import { prisma } from './lib/prisma.js'
import { initSocket } from './lib/socket.js'

const httpServer = createServer(app)
initSocket(httpServer)

// Purge expired revoked tokens every hour
setInterval(async () => {
  try {
    const result = await prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    if (result.count > 0) {
      console.log(JSON.stringify({ event: 'purge-revoked-tokens', count: result.count }))
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'purge-revoked-tokens-error', error: String(err) }))
  }
}, 60 * 60 * 1000)

httpServer.listen(config.port, () => {
  console.log(JSON.stringify({ event: 'server-start', port: config.port }))
})

export default httpServer
