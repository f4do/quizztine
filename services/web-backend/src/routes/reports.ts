import { Router, type Router as RouterType } from 'express'
import { optionalAuth } from '../middleware/auth.js'
import { reportQuestion } from '../controllers/reports.js'

const router: RouterType = Router()

router.post('/questions/:questionId/report', optionalAuth, reportQuestion)

export default router
