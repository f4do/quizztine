import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { register, verifyEmail, login, refresh, logout, me, updatePreferences } from '../controllers/auth.js'

const router: RouterType = Router()

router.post('/auth/register', register)
router.get('/auth/verify', verifyEmail)
router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/logout', logout)
router.get('/auth/me', authMiddleware, me)
router.patch('/auth/preferences', authMiddleware, updatePreferences)

export default router
