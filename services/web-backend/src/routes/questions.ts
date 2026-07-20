import { Router, type Router as RouterType } from 'express'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { listQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion } from '../controllers/questions.js'

const router: RouterType = Router()

router.get('/questions', optionalAuth, listQuestions)
router.get('/questions/:id', optionalAuth, getQuestion)
router.post('/questions', authMiddleware, createQuestion)
router.patch('/questions/:id', authMiddleware, updateQuestion)
router.delete('/questions/:id', authMiddleware, deleteQuestion)

export default router
