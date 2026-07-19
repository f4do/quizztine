import { Router, type Router as RouterType } from 'express'
import { listHosts, getActiveHost, getHost, createHost, updateHost, deleteHost, fetchAvatar } from '../controllers/host.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router: RouterType = Router()

// Public
router.get('/host/active', getActiveHost)

// Admin-only CRUD
router.get('/host', authMiddleware, requireRole('QUIZADMIN'), listHosts)
router.post('/host/fetch-avatar', authMiddleware, requireRole('QUIZADMIN'), fetchAvatar)
router.get('/host/:id', authMiddleware, requireRole('QUIZADMIN'), getHost)
router.post('/host', authMiddleware, requireRole('QUIZADMIN'), createHost)
router.put('/host/:id', authMiddleware, requireRole('QUIZADMIN'), updateHost)
router.delete('/host/:id', authMiddleware, requireRole('QUIZADMIN'), deleteHost)

export default router
