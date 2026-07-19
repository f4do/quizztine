import { Router, type Router as RouterType } from 'express'
import { optionalAuth } from '../middleware/auth.js'
import { createRoom, getRoomByCode, getRoomState, joinRoom, startGame, getCurrentQuestion, getScoreboard, replayRoom } from '../controllers/rooms.js'
import { getResults } from '../controllers/results.js'

const router: RouterType = Router()

// ── Callback routes removed (engine is now in-process) ─────────────
// POST /rooms/:id/question-finished  → handled by notifyBackend()
// POST /rooms/:id/next-question      → handled by notifyBackend()
// POST /rooms/:id/game-finished      → handled by notifyBackend()
// POST /rooms/:id/results            → handled by notifyBackend()
// ── Read result endpoint is kept ───────────────────────────────────
router.get('/rooms/:id/results', getResults)

// ── Player-facing routes ───────────────────────────────────────────
router.get('/rooms/code/:code', optionalAuth, getRoomByCode)
router.post('/rooms', optionalAuth, createRoom)
router.get('/rooms/:id', getRoomState)
router.post('/rooms/:id/join', joinRoom)
router.post('/rooms/:id/start', startGame)
router.get('/rooms/:id/current-question/:playerId', getCurrentQuestion)
router.get('/rooms/:id/scoreboard', getScoreboard)
router.post('/rooms/:id/replay', replayRoom)

export default router
