/* ------------------------------------------------------------------ */
/*  Core domain types (port of schemas.py + room_store.py)            */
/* ------------------------------------------------------------------ */

export type GameStatus = 'waiting' | 'playing' | 'finished'
export type RoomMode = 'solo' | 'multi_private' | 'multi_public'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type QuestionType = 'MCQ'

/* ------------------------------------------------------------------ */
/*  Player                                                             */
/* ------------------------------------------------------------------ */

export interface Player {
  id: string
  nickname: string
  score: number
  streak: number
  cumulativeTime: number
  finished: boolean
  disconnected: boolean
}

export interface RoundAnswer {
  questionId: number
  selectedChoices: number[]
  elapsed: number
  timeout: boolean
}

export interface AnswerRecord {
  playerId: string
  questionId: number
  correct: boolean
  timeSpent: number
}

/* ------------------------------------------------------------------ */
/*  Question                                                           */
/* ------------------------------------------------------------------ */

export interface QuestionState {
  id: number
  correctChoices: number[]
  difficulty: Difficulty
  questionType: QuestionType
}

/* ------------------------------------------------------------------ */
/*  Room                                                               */
/* ------------------------------------------------------------------ */

export interface Room {
  id: string
  code: string
  mode: RoomMode
  timer: number
  status: GameStatus
  questions: QuestionState[]
  shuffledQuestionIds: number[]
  players: Map<string, Player>
  answers: AnswerRecord[]

  // Round state
  currentQuestionIndex: number
  answeredPlayers: Set<string>
  currentRoundAnswers: Map<string, RoundAnswer>
  feedbackUntil: number | null
  questionStartedAt: number | null  // Date.now() when current question was shown

  // Timers
  deadlineTimer: ReturnType<typeof setTimeout> | null
  advanceTimer: ReturnType<typeof setTimeout> | null

  // Metadata
  totalQuestions: number
  creatorPlayerId: string | null
  createdAt: number
}

/* ------------------------------------------------------------------ */
/*  External payloads (port of schemas.py request/response types)      */
/* ------------------------------------------------------------------ */

export interface QuestionPayload {
  id: number
  correct_choices: number[]
  difficulty: string
  question_type: string
}

export interface CreateRoomParams {
  id?: string
  questions: QuestionPayload[]
  mode: RoomMode
  timer: number
  code?: string
  creator_player_id?: string
}

export interface JoinPayload {
  player_id: string
  nickname: string
}

export interface AnswerPayload {
  question_id: number
  selected_choices: number[]
  client_timestamp: number
}

export interface ReplayPayload {
  questions?: QuestionPayload[]
}

/* ------------------------------------------------------------------ */
/*  Response types (match shapes returned by the Python API)           */
/* ------------------------------------------------------------------ */

export interface CreateRoomResponse {
  id: string
  mode: RoomMode
  timer: number
  question_count: number
}

export interface JoinRoomResponse {
  room_id: string
  player_id: string
  nickname: string
}

export interface RoomResponse {
  id: string
  code: string
  mode: RoomMode
  timer: number
  status: GameStatus
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

export interface CurrentQuestionResponse {
  question_id: number
  index: number
}

export interface AnswerResponse {
  correct: boolean
  points: number
  bonus: number
  streak: number
  cumulative_time: number
}

export interface ScoreboardEntry {
  player_id: string
  nickname: string
  score: number
  streak: number
  cumulative_time: number
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

export interface ScoringContext {
  mode: RoomMode
  playerCount: number
  difficulty: Difficulty
  isCorrect: boolean
  currentStreak: number
  firstCorrect: boolean
  aloneCorrect: boolean
}

export interface ScoreResult {
  total: number
  bonus: number
  newStreak: number
}

/* ------------------------------------------------------------------ */
/*  Notification payloads                                              */
/* ------------------------------------------------------------------ */

export interface QuestionFinishedPayload {
  question_id: number
  correct_choices: number[]
  results: Array<{
    player_id: string
    nickname: string
    correct: boolean
    points: number
    bonus: number
    streak: number
    cumulative_time: number
  }>
}

export interface NextQuestionPayload {
  question_index: number
}

export interface ResultsPayload {
  scores: ScoreboardEntry[]
  answers: Array<{
    player_id: string
    question_id: number
    correct: boolean
    time_spent: number
  }>
}
