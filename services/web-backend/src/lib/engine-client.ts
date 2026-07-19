import { config } from '../config/index.js'
import { AppError } from '../types/errors.js'

interface QuestionPayload {
  id: number
  correctChoices: number[]
  difficulty: string
}

interface CreateRoomResponse {
  id: string
  mode: string
  timer: number
  question_count: number
}

interface AnswerResponse {
  correct: boolean
  points: number
  bonus: number
  streak: number
  cumulative_time: number
}

interface ScoreboardEntry {
  player_id: string
  nickname: string
  score: number
  streak: number
  cumulative_time: number
}

class EngineClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = config.quizEngineUrl
  }

  async createRoom(roomId: string, questions: QuestionPayload[], mode: string, timer: number, code?: string, creatorPlayerId?: string): Promise<CreateRoomResponse> {
    const body: Record<string, unknown> = {
      id: roomId,
      questions: questions.map((q) => ({
        id: q.id,
        correct_choices: q.correctChoices,
        difficulty: q.difficulty,
      })),
      mode,
      timer,
    }
    if (code) body.code = code
    if (creatorPlayerId) body.creator_player_id = creatorPlayerId
    const resp = await fetch(`${this.baseUrl}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      // FastAPI wraps error details in `detail` key
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
    return resp.json() as Promise<CreateRoomResponse>
  }

  async removePlayer(roomId: string, playerId: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/players/${playerId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
  }

  async joinRoom(roomId: string, playerId: string, nickname: string): Promise<void> {
    const body = { player_id: playerId, nickname }
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
  }

  async submitAnswer(roomId: string, playerId: string, questionId: number, selectedChoices: number[], clientTimestamp: number): Promise<AnswerResponse> {
    const body = {
      question_id: questionId,
      selected_choices: selectedChoices,
      client_timestamp: clientTimestamp,
    }
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/answer/${playerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
    return resp.json() as Promise<AnswerResponse>
  }

  async getRoom(roomId: string): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
    return resp.json()
  }

  async getCurrentQuestion(roomId: string, playerId: string): Promise<{ question_id: number; index: number }> {
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/current-question/${playerId}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
    return resp.json()
  }

  async startGame(roomId: string, playerId: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/start?player_id=${playerId}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
  }

  async replayRoom(roomId: string, questions?: QuestionPayload[]): Promise<void> {
    const body: Record<string, unknown> = {}
    if (questions) {
      body.questions = questions.map((q) => ({
        id: q.id,
        correct_choices: q.correctChoices,
        difficulty: q.difficulty,
      }))
    }
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
  }

  async getScoreboard(roomId: string): Promise<ScoreboardEntry[]> {
    const resp = await fetch(`${this.baseUrl}/rooms/${roomId}/scoreboard`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Engine error' }))
      const message = err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
      throw new AppError(503, 'ENGINE_ERROR', message)
    }
    return resp.json() as Promise<ScoreboardEntry[]>
  }
}

export const engineClient = new EngineClient()
