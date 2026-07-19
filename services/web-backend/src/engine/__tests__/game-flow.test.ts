import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { store } from '../room-store.js'
import { flow, FEEDBACK_DELAY_MS } from '../game-flow.js'
import { gameEngine } from '../index.js'
import type { CreateRoomParams, RoomMode } from '../types.js'

/* ------------------------------------------------------------------ */
/*  Mock notifications so we don't need controller imports             */
/* ------------------------------------------------------------------ */

vi.mock('../notifications.js', () => ({
  notifyBackend: vi.fn(),
}))

import { notifyBackend } from '../notifications.js'
const mockNotify = notifyBackend as ReturnType<typeof vi.fn>

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function ts() {
  return Date.now()
}

/** Build a standard question payload. */
function q(
  id: number,
  correct: number[],
  difficulty: string = 'easy',
  qtype: string = 'MCQ',
) {
  return { id, correct_choices: correct, difficulty, question_type: qtype }
}

/** Helper: submit an answer for a player and advance past the feedback delay. */
async function answerAndAdvance(
  roomId: string,
  playerId: string,
  selectedChoices: number[] = [0],
) {
  const room = store.get(roomId)!
  const qid = room.shuffledQuestionIds[room.currentQuestionIndex]
  await gameEngine.submitAnswer(roomId, playerId, {
    question_id: qid,
    selected_choices: selectedChoices,
    client_timestamp: ts() - 1000,
  })
  // Advance past allAnswered setImmediate + FEEDBACK_DELAY_MS
  await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)
}

/** Set up a solo game by directly using store + flow (player joins first, then starts). */
function setupSolo(overrides?: Partial<CreateRoomParams>): string {
  const id = overrides?.id ?? 'solo-test'
  const params: CreateRoomParams = {
    id,
    mode: 'solo',
    timer: 30,
    questions: [
      q(1, [0], 'easy'),
    ],
    ...overrides,
  }
  store.create(params)
  store.addPlayer(id, 'p1', 'Alice')
  flow.startGame(id, null)
  // Advance fake timers so questionStartedAt → Date.now() gives a non-zero elapsed
  vi.advanceTimersByTime(1000)
  return id
}

/** Set up a multi-player game through the facade. */
async function setupMulti(overrides?: Partial<CreateRoomParams>): Promise<string> {
  const id = overrides?.id ?? 'multi-test'
  const params: CreateRoomParams = {
    id,
    mode: 'multi_public',
    timer: 30,
    questions: [
      q(1, [0], 'easy'),
      q(2, [1], 'medium'),
    ],
    ...overrides,
  }
  await gameEngine.createRoom(params)
  await gameEngine.joinRoom(id, { player_id: 'p1', nickname: 'Alice' })
  await gameEngine.joinRoom(id, { player_id: 'p2', nickname: 'Bob' })
  await gameEngine.startGame(id, null)
  return id
}

beforeEach(() => {
  store.clear()
  vi.useFakeTimers()
  mockNotify.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

/* ================================================================== */
/*  Room lifecycle (port of test_routes.py)                            */
/* ================================================================== */

describe('CreateRoom', () => {
  it('creates a solo room in waiting state (join + start flow)', async () => {
    const res = await gameEngine.createRoom({
      id: 'solo-1',
      mode: 'solo',
      timer: 30,
      questions: [q(1, [0])],
    })
    expect(res.mode).toBe('solo')
    expect(res.timer).toBe(30)
    expect(res.question_count).toBe(1)

    const room = store.get('solo-1')!
    // Solo rooms no longer auto-start — player must join first
    expect(room.status).toBe('waiting')

    // Join, then start (matches handleSoloStart flow)
    await gameEngine.joinRoom('solo-1', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.startGame('solo-1', 'p1')
    expect(room.status).toBe('playing')
  })

  it('creates a multiplayer room in waiting state', async () => {
    const res = await gameEngine.createRoom({
      id: 'multi-1',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0]), q(2, [1])],
    })
    expect(res.mode).toBe('multi_public')
    expect(res.question_count).toBe(2)

    const room = store.get('multi-1')!
    expect(room.status).toBe('waiting')
  })
})

describe('JoinRoom', () => {
  it('joins a multiplayer room successfully', async () => {
    await gameEngine.createRoom({
      id: 'join-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    const res = await gameEngine.joinRoom('join-test', {
      player_id: 'p1',
      nickname: 'Alice',
    })
    expect(res.room_id).toBe('join-test')
    expect(res.player_id).toBe('p1')
    expect(res.nickname).toBe('Alice')
  })

  it('throws 409 when nickname is already taken', async () => {
    await gameEngine.createRoom({
      id: 'nick-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('nick-test', { player_id: 'p1', nickname: 'Alice' })
    await expect(
      gameEngine.joinRoom('nick-test', { player_id: 'p2', nickname: 'Alice' }),
    ).rejects.toThrow('already in room')
  })

  it('reconnects a disconnected player during game', async () => {
    await gameEngine.createRoom({
      id: 'recon-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('recon-test', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('recon-test', { player_id: 'p2', nickname: 'Bob' })
    await gameEngine.startGame('recon-test', null)

    // Mark player disconnected
    store.update('recon-test', (r) => {
      const p = r.players.get('p1')
      if (p) p.disconnected = true
    })

    // Reconnect with same player_id
    const res = await gameEngine.joinRoom('recon-test', {
      player_id: 'p1',
      nickname: 'Alice',
    })
    expect(res.player_id).toBe('p1')
    const room = store.get('recon-test')!
    expect(room.players.get('p1')!.disconnected).toBe(false)
  })

  it('throws 400 when joining an already started room (new player)', async () => {
    await gameEngine.createRoom({
      id: 'started-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('started-test', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('started-test', { player_id: 'p2', nickname: 'Bob' })
    await gameEngine.startGame('started-test', null)

    await expect(
      gameEngine.joinRoom('started-test', { player_id: 'p3', nickname: 'Charlie' }),
    ).rejects.toThrow('Game already started')
  })

  it('throws on unknown room', async () => {
    await expect(
      gameEngine.joinRoom('unknown', { player_id: 'p1', nickname: 'Alice' }),
    ).rejects.toThrow(/not found/i)
  })
})

describe('StartGame', () => {
  it('starts a multiplayer game successfully', async () => {
    await gameEngine.createRoom({
      id: 'start-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('start-test', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('start-test', { player_id: 'p2', nickname: 'Bob' })
    await gameEngine.startGame('start-test', null)

    const room = store.get('start-test')!
    expect(room.status).toBe('playing')
  })

  it('starts as creator when playerId matches creatorPlayerId', async () => {
    await gameEngine.createRoom({
      id: 'creator-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
      creator_player_id: 'p1',
    })
    await gameEngine.joinRoom('creator-test', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('creator-test', { player_id: 'p2', nickname: 'Bob' })
    // Creator starts
    await gameEngine.startGame('creator-test', 'p1')

    const room = store.get('creator-test')!
    expect(room.status).toBe('playing')
  })

  it('refuses start by non-creator (403)', async () => {
    await gameEngine.createRoom({
      id: 'non-creator-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
      creator_player_id: 'p1',
    })
    await gameEngine.joinRoom('non-creator-test', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('non-creator-test', { player_id: 'p2', nickname: 'Bob' })

    await expect(
      gameEngine.startGame('non-creator-test', 'p2'),
    ).rejects.toThrow('Only the room creator can start')
  })

  it('refuses to start a room with no players', async () => {
    await gameEngine.createRoom({
      id: 'no-players-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })

    await expect(
      gameEngine.startGame('no-players-test', null),
    ).rejects.toThrow('Cannot start a room with no players')
  })

  it('refuses to start an already started room', async () => {
    const id = await setupMulti()
    await expect(
      gameEngine.startGame(id, null),
    ).rejects.toThrow('already started')
  })

  it('throws on unknown room', async () => {
    await expect(
      gameEngine.startGame('unknown', null),
    ).rejects.toThrow(/not found/i)
  })
})

describe('GetCurrentQuestion', () => {
  it('returns the current question during a game', async () => {
    const id = setupSolo({
      id: 'cq-test',
      questions: [q(42, [0], 'easy')],
    })
    const qres = await gameEngine.getCurrentQuestion(id, 'p1')
    expect(qres.question_id).toBe(42)
    expect(qres.index).toBe(0)
  })

  it('throws if the game has not started', async () => {
    await gameEngine.createRoom({
      id: 'not-started',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('not-started', { player_id: 'p1', nickname: 'Alice' })
    // Don't start

    await expect(
      gameEngine.getCurrentQuestion('not-started', 'p1'),
    ).rejects.toThrow('Game is not in progress')
  })

  it('throws for an unknown player', async () => {
    const id = setupSolo({ id: 'unknown-player' })
    await expect(
      gameEngine.getCurrentQuestion(id, 'unknown'),
    ).rejects.toThrow('not in room')
  })
})

describe('SubmitAnswer', () => {
  it('correct answer returns points > 0 and correct = true', async () => {
    const id = setupSolo({ id: 'correct-ans', questions: [q(1, [0], 'easy')] })

    const qres = await gameEngine.getCurrentQuestion(id, 'p1')
    const res = await gameEngine.submitAnswer(id, 'p1', {
      question_id: qres.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })

    expect(res.correct).toBe(true)
    expect(res.points).toBeGreaterThanOrEqual(10)
    expect(res.cumulative_time).toBeGreaterThan(0)
  })

  it('wrong answer returns points = 0 and correct = false', async () => {
    const id = setupSolo({ id: 'wrong-ans', questions: [q(1, [0], 'easy')] })

    const qres = await gameEngine.getCurrentQuestion(id, 'p1')
    const res = await gameEngine.submitAnswer(id, 'p1', {
      question_id: qres.question_id,
      selected_choices: [999],
      client_timestamp: ts() - 1000,
    })

    expect(res.correct).toBe(false)
    expect(res.points).toBe(0)
  })

  it('throws for unknown question id', async () => {
    const id = setupSolo({ id: 'wrong-qid' })
    await expect(
      gameEngine.submitAnswer(id, 'p1', {
        question_id: 9999,
        selected_choices: [0],
        client_timestamp: ts(),
      }),
    ).rejects.toThrow('does not match the current question')
  })

  it('throws when game is not playing', async () => {
    await gameEngine.createRoom({
      id: 'not-playing',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('not-playing', { player_id: 'p1', nickname: 'Alice' })
    // started=false

    await expect(
      gameEngine.submitAnswer('not-playing', 'p1', {
        question_id: 1,
        selected_choices: [0],
        client_timestamp: ts(),
      }),
    ).rejects.toThrow('Game is not in progress')
  })
})

describe('GetScoreboard', () => {
  it('returns empty array for a room with no players', async () => {
    const res = await gameEngine.createRoom({
      id: 'empty-sb',
      mode: 'solo',
      timer: 30,
      questions: [q(1, [0])],
    })
    const sb = await gameEngine.getScoreboard(res.id)
    expect(sb).toEqual([])
  })

  it('returns players sorted by score descending', async () => {
    const id = await setupMulti({ id: 'sb-order' })
    // Both answer all questions correctly
    for (let i = 0; i < 2; i++) {
      const q1 = await gameEngine.getCurrentQuestion(id, 'p1')
      const q2 = await gameEngine.getCurrentQuestion(id, 'p2')
      await gameEngine.submitAnswer(id, 'p1', {
        question_id: q1.question_id,
        selected_choices: [0],
        client_timestamp: ts() - 1000,
      })
      await gameEngine.submitAnswer(id, 'p2', {
        question_id: q2.question_id,
        selected_choices: q2.question_id === 1 ? [0] : [1],
        client_timestamp: ts() - 500,
      })
      await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)
    }

    const sb = await gameEngine.getScoreboard(id)
    expect(sb).toHaveLength(2)
    expect(sb[0].score).toBeGreaterThanOrEqual(sb[1].score)
  })
})

describe('RemovePlayer', () => {
  it('removes a player from a waiting room', async () => {
    await gameEngine.createRoom({
      id: 'remove-test',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0])],
    })
    await gameEngine.joinRoom('remove-test', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('remove-test', { player_id: 'p2', nickname: 'Bob' })
    await gameEngine.removePlayer('remove-test', 'p1')

    const room = store.get('remove-test')!
    expect(room.players.has('p1')).toBe(false)
    expect(room.players.has('p2')).toBe(true)
  })

  it('marks a player as disconnected during a game', async () => {
    const id = await setupMulti({ id: 'disconnect-test' })
    await gameEngine.removePlayer(id, 'p2')

    const room = store.get(id)!
    expect(room.players.get('p2')!.disconnected).toBe(true)
  })
})

describe('ReplayRoom', () => {
  it('replays a finished room', async () => {
    const id = setupSolo({ id: 'replay-test', questions: [q(1, [0])] })
    await answerAndAdvance(id, 'p1')

    // Room should be finished
    const roomAfter = store.get(id)!
    expect(roomAfter.status).toBe('finished')

    // Replay
    const replayRes = await gameEngine.replayRoom(id)
    expect(replayRes.status).toBe('replayed')

    const roomReplayed = store.get(id)!
    expect(roomReplayed.status).toBe('waiting')
    expect(roomReplayed.players.get('p1')!.score).toBe(0)
  })

  it('refuses to replay a room that is not finished', async () => {
    const id = setupSolo({ id: 'replay-fail' })
    await expect(
      gameEngine.replayRoom(id),
    ).rejects.toThrow('is not finished')
  })
})

/* ================================================================== */
/*  Game flow scenarios (port of test_game_flow.py)                    */
/* ================================================================== */

describe('SoloFullGame', () => {
  it('answers all questions correctly and game finishes', async () => {
    const id = setupSolo({
      id: 'full-game',
      questions: [q(1, [0], 'easy'), q(2, [0], 'medium'), q(3, [0], 'hard')],
    })

    let totalPoints = 0
    for (let expIdx = 0; expIdx < 3; expIdx++) {
      const qres = await gameEngine.getCurrentQuestion(id, 'p1')
      expect(qres.index).toBe(expIdx)

      const ans = await gameEngine.submitAnswer(id, 'p1', {
        question_id: qres.question_id,
        selected_choices: [0],
        client_timestamp: ts() - 1000,
      })
      expect(ans.correct).toBe(true)
      totalPoints += ans.points

      await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)
    }

    const room = store.get(id)!
    expect(room.status).toBe('finished')
    expect(room.currentQuestionIndex).toBe(3)

    const sb = await gameEngine.getScoreboard(id)
    expect(sb).toHaveLength(1)
    expect(sb[0].score).toBe(totalPoints)
  })

  it('mixed correct/wrong answers produce correct final score', async () => {
    const id = setupSolo({
      id: 'mixed-ans',
      questions: [q(1, [0], 'easy'), q(2, [0], 'easy'), q(3, [0], 'easy')],
    })

    // Q1: correct
    const q1 = await gameEngine.getCurrentQuestion(id, 'p1')
    const r1 = await gameEngine.submitAnswer(id, 'p1', {
      question_id: q1.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    expect(r1.correct).toBe(true)
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    // Q2: wrong
    const q2 = await gameEngine.getCurrentQuestion(id, 'p1')
    const r2 = await gameEngine.submitAnswer(id, 'p1', {
      question_id: q2.question_id,
      selected_choices: [999],
      client_timestamp: ts() - 1000,
    })
    expect(r2.correct).toBe(false)
    expect(r2.points).toBe(0)
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    // Q3: correct
    const q3 = await gameEngine.getCurrentQuestion(id, 'p1')
    const r3 = await gameEngine.submitAnswer(id, 'p1', {
      question_id: q3.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    expect(r3.correct).toBe(true)
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    const room = store.get(id)!
    expect(room.status).toBe('finished')

    const sb = await gameEngine.getScoreboard(id)
    expect(sb[0].score).toBe(r1.points + r3.points)
  })
})

describe('TimerExpiry', () => {
  it('late answer after deadline fires returns timeout result (race condition)', async () => {
    const id = setupSolo({ id: 'race-condition', questions: [q(1, [0], 'easy')] })

    const qres = await gameEngine.getCurrentQuestion(id, 'p1')

    // Manually set feedbackUntil as if finishRound already ran
    store.update(id, (r) => {
      r.feedbackUntil = ts() + FEEDBACK_DELAY_MS
      r.answeredPlayers.add('p1')
    })

    // Now submit a late answer → should return timeout (not 400)
    const ans = await gameEngine.submitAnswer(id, 'p1', {
      question_id: qres.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    expect(ans.correct).toBe(false)
    expect(ans.points).toBe(0)
  })

  it('deadline timer finishes the round when timer expires', async () => {
    const id = setupSolo({ id: 'deadline-test', timer: 5, questions: [q(1, [0], 'easy')] })

    // Don't answer — let the deadline timer fire
    await vi.advanceTimersByTimeAsync(6000) // past 5s deadline

    const room = store.get(id)!
    // The round should have been finished by the deadline timer
    expect(room.feedbackUntil).not.toBeNull()
  })
})

describe('MultiplayerSynchronized', () => {
  it('both players see the same question', async () => {
    const id = await setupMulti({ id: 'sync-q' })

    const q1 = await gameEngine.getCurrentQuestion(id, 'p1')
    const q2 = await gameEngine.getCurrentQuestion(id, 'p2')
    expect(q1.question_id).toBe(q2.question_id)
    expect(q1.index).toBe(q2.index)
    expect(q1.index).toBe(0)
  })

  it('round does not advance until all active players answer', async () => {
    await gameEngine.createRoom({
      id: 'wait-all',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0], 'easy')],
    })
    await gameEngine.joinRoom('wait-all', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('wait-all', { player_id: 'p2', nickname: 'Bob' })
    await gameEngine.startGame('wait-all', null)

    // Only p1 answers
    const qq = await gameEngine.getCurrentQuestion('wait-all', 'p1')
    await gameEngine.submitAnswer('wait-all', 'p1', {
      question_id: qq.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    // Advance 100ms — the round should NOT finish (p2 hasn't answered)
    await vi.advanceTimersByTimeAsync(100)

    const room = store.get('wait-all')!
    expect(room.feedbackUntil).toBeNull()
    expect(room.currentQuestionIndex).toBe(0)

    // Now p2 answers
    await gameEngine.submitAnswer('wait-all', 'p2', {
      question_id: qq.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 500,
    })
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    const room2 = store.get('wait-all')!
    expect(room2.status).toBe('finished')
  })

  it('disconnected player does not block round from finishing', async () => {
    await gameEngine.createRoom({
      id: 'disconnect-block',
      mode: 'multi_public',
      timer: 30,
      questions: [q(1, [0], 'easy')],
    })
    await gameEngine.joinRoom('disconnect-block', { player_id: 'p1', nickname: 'Alice' })
    await gameEngine.joinRoom('disconnect-block', { player_id: 'p2', nickname: 'Bob' })
    await gameEngine.startGame('disconnect-block', null)

    // p1 answers, p2 disconnects
    const qq = await gameEngine.getCurrentQuestion('disconnect-block', 'p1')
    await gameEngine.submitAnswer('disconnect-block', 'p1', {
      question_id: qq.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    await gameEngine.removePlayer('disconnect-block', 'p2')

    // Advance past feedback
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    const room = store.get('disconnect-block')!
    expect(room.status).toBe('finished')
  })
})

describe('QuestionProgression', () => {
  it('question index advances correctly after each answer', async () => {
    const id = setupSolo({
      id: 'q-progress',
      questions: [q(10, [0], 'easy'), q(20, [0], 'easy'), q(30, [0], 'easy')],
    })

    // Q1
    const q1 = await gameEngine.getCurrentQuestion(id, 'p1')
    expect(q1.index).toBe(0)
    expect([10, 20, 30]).toContain(q1.question_id)
    await gameEngine.submitAnswer(id, 'p1', {
      question_id: q1.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    // Q2
    const q2 = await gameEngine.getCurrentQuestion(id, 'p1')
    expect(q2.index).toBe(1)
    expect(q2.question_id).not.toBe(q1.question_id)
    expect([10, 20, 30]).toContain(q2.question_id)
    await gameEngine.submitAnswer(id, 'p1', {
      question_id: q2.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    // Q3
    const q3 = await gameEngine.getCurrentQuestion(id, 'p1')
    expect(q3.index).toBe(2)
    expect(q3.question_id).not.toBe(q1.question_id)
    expect(q3.question_id).not.toBe(q2.question_id)
    expect([10, 20, 30]).toContain(q3.question_id)
  })
})

describe('BackendNotifications', () => {
  it('sends question-finished and next-question during solo game', async () => {
    mockNotify.mockClear()
    const id = setupSolo({
      id: 'notify-test',
      questions: [q(1, [0], 'easy'), q(2, [0], 'easy')],
    })

    // Q1 -> should trigger question-finished + next-question
    const q1 = await gameEngine.getCurrentQuestion(id, 'p1')
    await gameEngine.submitAnswer(id, 'p1', {
      question_id: q1.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    const calls1 = mockNotify.mock.calls.map((c: unknown[]) => c[1])
    expect(calls1).toContain('question-finished')
    expect(calls1).toContain('next-question')
    expect(calls1).not.toContain('game-finished')

    mockNotify.mockClear()

    // Q2 -> should trigger question-finished + game-finished (no more questions)
    const q2 = await gameEngine.getCurrentQuestion(id, 'p1')
    await gameEngine.submitAnswer(id, 'p1', {
      question_id: q2.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    const calls2 = mockNotify.mock.calls.map((c: unknown[]) => c[1])
    expect(calls2).toContain('question-finished')
    expect(calls2).toContain('game-finished')
  })
})

describe('ScoreboardTiebreaker', () => {
  it('tiebreaker sorts by cumulative time ascending', async () => {
    const id = await setupMulti({ id: 'tiebreaker', questions: [q(1, [0], 'easy')] })

    // Both answer correctly: same score
    // p2 answers faster (0.5s) than p1 (2.0s) using server-side elapsed
    const q1 = await gameEngine.getCurrentQuestion(id, 'p1')
    const q2 = await gameEngine.getCurrentQuestion(id, 'p2')

    // p2 answers quickly — advance to 0.5s
    vi.advanceTimersByTime(500)
    await gameEngine.submitAnswer(id, 'p2', {
      question_id: q2.question_id,
      selected_choices: [0],
      client_timestamp: 0,
    })
    // p1 answers later — advance to 2.0s
    vi.advanceTimersByTime(1500)
    await gameEngine.submitAnswer(id, 'p1', {
      question_id: q1.question_id,
      selected_choices: [0],
      client_timestamp: 0,
    })
    await vi.advanceTimersByTimeAsync(FEEDBACK_DELAY_MS + 200)

    const sb = await gameEngine.getScoreboard(id)
    // Both have same score, p2 answered faster -> p2 should be first
    expect(sb).toHaveLength(2)
    expect(sb[0].player_id).toBe('p2')
    expect(sb[1].player_id).toBe('p1')
    expect(sb[0].cumulative_time).toBeLessThan(sb[1].cumulative_time)
  })
})

describe('LateAnswerRaceCondition', () => {
  it('submitAnswer returns timeout when feedbackUntil is set but player not answered', async () => {
    const id = setupSolo({ id: 'late-unanswered', questions: [q(1, [0], 'easy')] })

    const qres = await gameEngine.getCurrentQuestion(id, 'p1')

    // Simulate: deadline finished the round, feedbackUntil set, but p1 not yet in answeredPlayers
    store.update(id, (r) => {
      r.feedbackUntil = ts() + FEEDBACK_DELAY_MS
      // Do NOT add p1 to answeredPlayers — the deadline task didn't register p1
    })

    const ans = await gameEngine.submitAnswer(id, 'p1', {
      question_id: qres.question_id,
      selected_choices: [0],
      client_timestamp: ts() - 1000,
    })
    // Should get timeout response, not 400
    expect(ans.correct).toBe(false)
    expect(ans.points).toBe(0)
  })
})
