import { Router, type Router as RouterType } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { listUsers, updateUser, deleteUser, resetUserPassword, resetUserTOTP, getMe, updateMe, updateMyPassword, deleteMe } from '../controllers/users.js'
import { getMyStats } from '../controllers/results.js'

const router: RouterType = Router()

router.get('/users/me', authMiddleware, getMe)
router.patch('/users/me', authMiddleware, updateMe)
router.patch('/users/me/password', authMiddleware, updateMyPassword)
router.delete('/users/me', authMiddleware, deleteMe)
router.get('/users/me/stats', authMiddleware, getMyStats)
router.get('/users', authMiddleware, requireRole('QUIZADMIN'), listUsers)
router.patch('/users/:id', authMiddleware, requireRole('QUIZADMIN'), updateUser)
router.delete('/users/:id', authMiddleware, requireRole('QUIZADMIN'), deleteUser)
router.post('/users/:id/reset-password', authMiddleware, requireRole('QUIZADMIN'), resetUserPassword)
router.post('/users/:id/reset-totp', authMiddleware, requireRole('QUIZADMIN'), resetUserTOTP)

export default router
