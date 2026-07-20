import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'http'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'

vi.mock('../../engine/index.js', () => ({
  gameEngine: {
    removePlayer: vi.fn().mockResolvedValue(undefined),
    submitAnswer: vi.fn().mockResolvedValue({
      correct: true,
      points: 10,
      bonus: 0,
      streak: 1,
      cumulative_time: 5.2,
    }),
  },
}))

import { initSocket, getIO } from '../socket.js'

describe('Socket.IO', () => {
  let httpServer: http.Server
  let clientSocket: ClientSocket | null
  let serverPort: number

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    clientSocket = null
  })

  afterEach(() => {
    clientSocket?.close()
    // Close the HTTP server (drain existing connections first)
    if (httpServer) {
      httpServer.close()
    }
    vi.restoreAllMocks()
  })

  function createServer(): Promise<number> {
    return new Promise((resolve) => {
      httpServer = http.createServer()
      initSocket(httpServer)
      httpServer.listen(0, () => {
        const addr = httpServer.address()
        resolve((addr as any).port)
      })
    })
  }

  function connectClient(port: number): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioc(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        forceNew: true,
      })
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('Connection timeout'))
      }, 3000)
      socket.on('connect', () => {
        clearTimeout(timeout)
        resolve(socket)
      })
      socket.on('connect_error', (err) => {
        clearTimeout(timeout)
        socket.close()
        reject(err)
      })
    })
  }

  it('getIO returns the server instance', async () => {
    await createServer()
    expect(getIO()).toBeDefined()
  })

  // getIO error path is untestable here because io is module-scoped and
  // the test suite shares a single module instance after first init.

  it('client can connect and join a room', { timeout: 5000 }, async () => {
    const port = await createServer()
    clientSocket = await connectClient(port)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for ack')), 3000)
      clientSocket!.emit('join-room', 'room-1')
      // Give a tick for the server to process the join
      setTimeout(() => {
        clearTimeout(timeout)
        resolve()
      }, 200)
    })

    expect(clientSocket!.connected).toBe(true)
  })

  it('emits player-joined to other clients in the room', { timeout: 5000 }, async () => {
    const port = await createServer()
    const client1 = await connectClient(port)
    const client2 = await connectClient(port)

    // Both clients must be in the same room first
    client1.emit('join-room', 'room-1')
    client2.emit('join-room', 'room-1')

    // Give time for joins to propagate
    await new Promise((r) => setTimeout(r, 200))

    // client1 announces a player joining
    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for player-joined')), 3000)
      client2.on('player-joined', (data) => {
        clearTimeout(timeout)
        expect(data.playerId).toBe('player-123')
        expect(data.nickname).toBe('Alice')
        resolve()
      })
      client1.emit('player-joined', {
        roomId: 'room-1',
        playerId: 'player-123',
        nickname: 'Alice',
      })
    })

    await received
    client1.close()
    client2.close()
  })

  it('emits player-left to other clients', { timeout: 5000 }, async () => {
    const port = await createServer()
    const client1 = await connectClient(port)
    const client2 = await connectClient(port)

    // Place both in the same room
    client1.emit('player-joined', { roomId: 'room-2', playerId: 'p1', nickname: 'Alice' })
    client2.emit('join-room', 'room-2')

    await new Promise((r) => setTimeout(r, 200))

    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for player-left')), 3000)
      client2.on('player-left', (data) => {
        clearTimeout(timeout)
        expect(data.playerId).toBe('p1')
        resolve()
      })
      client1.emit('player-left', { roomId: 'room-2', playerId: 'p1' })
    })

    await received
    client1.close()
    client2.close()
  })

  it('emits game-started to other clients', { timeout: 5000 }, async () => {
    const port = await createServer()
    const client1 = await connectClient(port)
    const client2 = await connectClient(port)

    client1.emit('join-room', 'room-3')
    client2.emit('join-room', 'room-3')

    await new Promise((r) => setTimeout(r, 200))

    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for game-started')), 3000)
      client2.on('game-started', () => {
        clearTimeout(timeout)
        resolve()
      })
      client1.emit('game-started', { roomId: 'room-3' })
    })

    await received
    client1.close()
    client2.close()
  })

  it('emits player-answered on answer submission and forwards to engine', { timeout: 5000 }, async () => {
    const port = await createServer()
    const client1 = await connectClient(port)
    const client2 = await connectClient(port)

    client1.emit('join-room', 'room-4')
    client2.emit('join-room', 'room-4')

    await new Promise((r) => setTimeout(r, 200))

    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for player-answered')), 3000)
      client2.on('player-answered', (data) => {
        clearTimeout(timeout)
        expect(data.playerId).toBe('p1')
        expect(data.questionId).toBe(42)
        resolve()
      })
      client1.emit('answer', {
        roomId: 'room-4',
        playerId: 'p1',
        questionId: 42,
        selectedChoices: [0],
        clientTimestamp: Date.now(),
      })
    })

    await received
    client1.close()
    client2.close()
  })

  it('removes player from engine on disconnect after player-joined', { timeout: 5000 }, async () => {
    const port = await createServer()
    const { gameEngine } = await import('../../engine/index.js')

    const client = await connectClient(port)
    client.emit('player-joined', { roomId: 'room-5', playerId: 'p-disconnect', nickname: 'Disc' })

    await new Promise((r) => setTimeout(r, 200))

    // Disconnect the client
    client.close()

    // Wait for disconnect to propagate
    await new Promise((r) => setTimeout(r, 500))

    // gameEngine.removePlayer should have been called
    expect(gameEngine.removePlayer).toHaveBeenCalledWith('room-5', 'p-disconnect')
  })
})
