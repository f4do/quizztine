import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

const sockets = new Map<string, Socket>()

export function getSocket(roomId: string): Socket {
  let socket = sockets.get(roomId)
  if (!socket) {
    socket = io(SOCKET_URL)
    sockets.set(roomId, socket)
  }
  return socket
}

export function emitPlayerLeft(roomId: string, playerId: string) {
  const socket = sockets.get(roomId)
  if (socket) {
    socket.emit('player-left', { roomId, playerId })
  }
}

export function disconnectRoom(roomId: string) {
  const socket = sockets.get(roomId)
  if (socket) {
    socket.emit('leave-room', roomId)
    socket.disconnect()
    sockets.delete(roomId)
  }
}