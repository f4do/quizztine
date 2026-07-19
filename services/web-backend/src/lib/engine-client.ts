import { config } from '../config/index.js'
import { AppError } from '../types/errors.js'
import logger from '../lib/logger.js'

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface QuestionPayload {
  id: number
  correct_choices: number[]
  difficulty: string
  question_type: string
}

export interface CreateRoomPayload {
  id?: string
  questions: QuestionPayload[]
  mode: string
  timer: number
  code?: string
  creator_player_id?: string
}

interface CreateRoomResponse {
  id: string
  mode: string
  timer: number
  question_count: number
}

interface JoinRoomPayload {
  player_id: string
  nickname: string
}

interface JoinRoomResponse {
  room_id: string
  player_id: string
  nickname: string
}

interface AnswerPayload {
  question_id: number
  selected_choices: number[]
  client_timestamp: number
}

interface AnswerResponse {
  correct: boolean
  points: number
  bonus: number
  streak: number
  cumulative_time: number
}

interface RoomResponse {
  id: string
  code: string
  mode: string
  timer: number
  status: string
  player_count: number
  current_question_index: number
  total_questions: number
  players: Array<{
    id: string
    nickname: string
    score: number
    streak: number
    cumulative_time: number
    finished: boolean
    disconnected: boolean
    answered: boolean
  }>
}

interface CurrentQuestionResponse {
  question_id: number
  index: number
}

interface ScoreboardEntry {
  player_id: string
  nickname: string
  score: number
  streak: number
  cumulative_time: number
}

interface ReplayPayload {
  questions?: QuestionPayload[]
}

interface ReplayResponse {
  status: string
}

/* ------------------------------------------------------------------ */
/*  Client class                                                       */
/* ------------------------------------------------------------------ */

class EngineClient {
  private baseUrl: string

  constructor(baseUrl = config.quizEngineUrl) {
    this.baseUrl = baseUrl
  }

  /**
   * Low-level request helper.
   *
   * @param method  HTTP method
   * @param path    URL path (appended to baseUrl)
   * @param body    Optional request body (serialised as JSON)
   * @param options.timeout  Per-request timeout in ms (default: config.engineTimeout)
   * @param options.retries  Number of automatic retries on timeouts / 5xx (default: 0)
   */
  private async _request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { timeout?: number; retries?: number },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const timeout = options?.timeout ?? config.engineTimeout
    const retries = options?.retries ?? 0

    logger.debug({ method, path, timeout }, 'engine request')

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, {
          method,
          headers:
            body !== undefined
              ? { 'Content-Type': 'application/json' }
              : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeout),
        })

        if (resp.ok) {
          // Some responses (e.g. 204 No Content) have no body; return early
          if (
            resp.status === 204 ||
            resp.headers?.get('content-length') === '0'
          ) {
            return undefined as unknown as T
          }
          return (await resp.json()) as T
        }

        // Uniform error handling – extracted once
        const err = await resp.json().catch(() => ({ error: 'Engine error' }))
        const message =
          err.detail?.error ?? err.error ?? 'Quiz-engine unavailable'
        throw new AppError(503, 'ENGINE_ERROR', message)
      } catch (err) {
        if (err instanceof AppError) throw err

        // Retry on transient failures (timeouts / 5xx) when retries > 0
        if (attempt < retries) {
          const delay = 100 * Math.pow(2, attempt) // 100 ms, 200 ms, 400 ms …
          logger.warn(
            { err, method, path, attempt, retries },
            'engine request failed, retrying',
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        logger.error(
          { err, method, path, timeout },
          'engine request failed',
        )
        throw new AppError(503, 'ENGINE_ERROR', 'Quiz-engine unavailable')
      }
    }

    // TypeScript unreachable – the loop always returns or throws
    throw new AppError(503, 'ENGINE_ERROR', 'Quiz-engine unavailable')
  }

  /* ------------------------------------------------------------------ */
  /*  Public API methods – each is a thin one-liner                      */
  /* ------------------------------------------------------------------ */

  async createRoom(data: CreateRoomPayload): Promise<CreateRoomResponse> {
    return this._request<CreateRoomResponse>('POST', '/rooms', data)
  }

  async removePlayer(roomId: string, playerId: string): Promise<void> {
    await this._request<void>(
      'DELETE',
      `/rooms/${roomId}/players/${playerId}`,
    )
  }

  async joinRoom(
    roomId: string,
    data: JoinRoomPayload,
  ): Promise<JoinRoomResponse> {
    return this._request<JoinRoomResponse>(
      'POST',
      `/rooms/${roomId}/join`,
      data,
    )
  }

  async submitAnswer(
    roomId: string,
    playerId: string,
    data: AnswerPayload,
  ): Promise<AnswerResponse> {
    return this._request<AnswerResponse>(
      'POST',
      `/rooms/${roomId}/answer/${playerId}`,
      data,
    )
  }

  async getRoom(roomId: string): Promise<RoomResponse> {
    return this._request<RoomResponse>('GET', `/rooms/${roomId}`)
  }

  async getCurrentQuestion(
    roomId: string,
    playerId: string,
  ): Promise<CurrentQuestionResponse> {
    return this._request<CurrentQuestionResponse>(
      'GET',
      `/rooms/${roomId}/current-question/${playerId}`,
    )
  }

  async startGame(roomId: string, playerId: string): Promise<void> {
    await this._request<void>(
      'POST',
      `/rooms/${roomId}/start?player_id=${playerId}`,
    )
  }

  async replayRoom(
    roomId: string,
    data?: ReplayPayload,
  ): Promise<ReplayResponse> {
    return this._request<ReplayResponse>(
      'POST',
      `/rooms/${roomId}/replay`,
      data,
    )
  }

  async getScoreboard(roomId: string): Promise<ScoreboardEntry[]> {
    return this._request<ScoreboardEntry[]>('GET', `/rooms/${roomId}/scoreboard`)
  }
}

export const engineClient = new EngineClient()
