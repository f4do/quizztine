import { Router, type Router as RouterType } from 'express'
import { optionalAuth } from '../middleware/auth.js'
import { createRoom, getRoomByCode, getRoomState, joinRoom, startGame, getCurrentQuestion, getScoreboard } from '../controllers/rooms.js'
import { receiveResults, getResults } from '../controllers/results.js'
import { questionFinished, nextQuestion, gameFinished } from '../controllers/room-events.js'

const router: RouterType = Router()

router.get('/rooms/code/:code', optionalAuth, getRoomByCode)
router.post('/rooms', optionalAuth, createRoom)
router.post('/rooms/:id/results', receiveResults)
router.get('/rooms/:id/results', getResults)
router.post('/rooms/:id/question-finished', questionFinished)
router.post('/rooms/:id/next-question', nextQuestion)
router.post('/rooms/:id/game-finished', gameFinished)

router.get('/rooms/:id', getRoomState)
router.post('/rooms/:id/join', joinRoom)
router.post('/rooms/:id/start', startGame)
router.get('/rooms/:id/current-question/:playerId', getCurrentQuestion)
router.get('/rooms/:id/scoreboard', getScoreboard)

export default router
