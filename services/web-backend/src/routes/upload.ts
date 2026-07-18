import { Router, type Router as RouterType } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { uploadFile } from '../controllers/upload.js'

const router: RouterType = Router()

router.post('/upload', authMiddleware, requireRole('QUIZMASTER', 'QUIZADMIN'), upload.single('file'), uploadFile)

export default router
