import { Router, type Router as RouterType } from 'express'
import { authLimiter } from '../middleware/rate-limit.js'
import { setupStatus, setup } from '../controllers/setup.js'

const router: RouterType = Router()

router.get('/auth/setup-status', setupStatus)
router.post('/auth/setup', authLimiter, setup)

export default router
