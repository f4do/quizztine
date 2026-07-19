import { Router, type Router as RouterType } from 'express'
import {
  listHosts, getActiveHost, getHost, createHost, updateHost, deleteHost, fetchAvatar,
  listPhrases, getPhraseContexts, getRandomPhrase, createPhrase, updatePhrase, deletePhrase,
} from '../controllers/host.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router: RouterType = Router()

// Public
router.get('/host/active', getActiveHost)
router.get('/host/phrases/random', getRandomPhrase)

// Admin-only phrase CRUD
router.get('/host/phrases/contexts', authMiddleware, requireRole('QUIZADMIN'), getPhraseContexts)
router.get('/host/phrases', authMiddleware, requireRole('QUIZADMIN'), listPhrases)
router.post('/host/phrases', authMiddleware, requireRole('QUIZADMIN'), createPhrase)
router.put('/host/phrases/:id', authMiddleware, requireRole('QUIZADMIN'), updatePhrase)
router.delete('/host/phrases/:id', authMiddleware, requireRole('QUIZADMIN'), deletePhrase)

// Admin-only host CRUD
router.get('/host', authMiddleware, requireRole('QUIZADMIN'), listHosts)
router.post('/host/fetch-avatar', authMiddleware, requireRole('QUIZADMIN'), fetchAvatar)
router.get('/host/:id', authMiddleware, requireRole('QUIZADMIN'), getHost)
router.post('/host', authMiddleware, requireRole('QUIZADMIN'), createHost)
router.put('/host/:id', authMiddleware, requireRole('QUIZADMIN'), updateHost)
router.delete('/host/:id', authMiddleware, requireRole('QUIZADMIN'), deleteHost)

export default router
