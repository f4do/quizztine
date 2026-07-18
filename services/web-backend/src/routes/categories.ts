import { Router, type Router as RouterType } from 'express'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { listCategories, createCategory, deleteCategory } from '../controllers/categories.js'

const router: RouterType = Router()

router.get('/categories', optionalAuth, listCategories)
router.post('/categories', authMiddleware, createCategory)
router.delete('/categories/:id', authMiddleware, deleteCategory)

export default router
