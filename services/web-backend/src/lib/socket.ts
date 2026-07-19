import { Server as HTTPServer } from 'http'
import { Server } from 'socket.io'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { config } from '../config/index.js'
import { engineClient } from './engine-client.js'

let io: Server

interface PlayerInfo {
  roomId: string
  playerId: string
}

const socketToPlayer = new Map<string, PlayerInfo>()

export function initSocket(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  })

  io.on('connection', (socket) => {
    const req = socket.request as AuthenticatedRequest
    console.log(JSON.stringify({ event: 'socket-connected', socketId: socket.id }))

    socket.on('join-room', (roomId: string) => {
      socket.join(`room:${roomId}`)
      console.log(JSON.stringify({ event: 'socket-join-room', socketId: socket.id, roomId }))
    })

    socket.on('leave-room', (roomId: string) => {
      socket.leave(`room:${roomId}`)
    })

    socket.on('player-joined', (data: { roomId: string; playerId: string; nickname: string }) => {
      socketToPlayer.set(socket.id, { roomId: data.roomId, playerId: data.playerId })
      socket.join(`room:${data.roomId}`)
      socket.to(`room:${data.roomId}`).emit('player-joined', {
        playerId: data.playerId,
        nickname: data.nickname,
      })
    })

    socket.on('player-left', (data: { roomId: string; playerId: string }) => {
      socketToPlayer.delete(socket.id)
      socket.leave(`room:${data.roomId}`)
      socket.to(`room:${data.roomId}`).emit('player-left', {
        playerId: data.playerId,
      })
      engineClient.removePlayer(data.roomId, data.playerId).catch(() => {})
    })

    socket.on('player-ready', (data: { roomId: string; playerId: string; ready: boolean }) => {
      socket.to(`room:${data.roomId}`).emit('player-ready', {
        playerId: data.playerId,
        ready: data.ready,
      })
    })

    socket.on('game-started', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('game-started')
    })

    socket.on('answer', async (data: { roomId: string; playerId: string; questionId: number; selectedChoices: number[]; clientTimestamp: number }) => {
      // Notify other players that someone has answered.
      socket.to(`room:${data.roomId}`).emit('player-answered', {
        playerId: data.playerId,
        questionId: data.questionId,
      })
      // Forward to quiz-engine for scoring.
      try {
        await engineClient.submitAnswer(
          data.roomId,
          data.playerId,
          data.questionId,
          data.selectedChoices,
          data.clientTimestamp,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(JSON.stringify({ event: 'answer-forward-error', error: message }))
        io.to(socket.id).emit('answer-error', { error: message })
      }
    })

    socket.on('disconnect', () => {
      const info = socketToPlayer.get(socket.id)
      if (info) {
        socketToPlayer.delete(socket.id)
        socket.to(`room:${info.roomId}`).emit('player-left', {
          playerId: info.playerId,
        })
        engineClient.removePlayer(info.roomId, info.playerId).catch(() => {})
      }
      console.log(JSON.stringify({ event: 'socket-disconnected', socketId: socket.id }))
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
