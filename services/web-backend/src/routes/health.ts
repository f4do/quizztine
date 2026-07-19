import { Router, type Router as RouterType } from 'express'
import { prisma } from '../lib/prisma.js'

const router: RouterType = Router()

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected' })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

export default router
