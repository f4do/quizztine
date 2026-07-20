import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoomGame } from "../useRoomGame";
import type {
  RoomInfo,
  QuestionFeedbackPayload,
  ScoreboardEntry,
} from "../useRoomGameTypes";

/* ── Shared socket handler registry ──────────────────────────────────
 *  vi.mock is hoisted, so we use vi.hoisted() to make values available
 *  before the hoisted mock factories run.                         */

const { mockSocket, socketHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    socketHandlers: handlers,
    mockSocket: {
      emit: vi.fn(),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handler;
      }),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
  };
});

/* ── Module-level mocks ──────────────────────────────────────────── */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../api", () => ({
  api: vi.fn(),
  mediaUrl: vi.fn((url: string | null | undefined) => url ?? null),
}));

vi.mock("../socket", () => ({
  getSocket: vi.fn(() => mockSocket),
  disconnectRoom: vi.fn(),
  emitPlayerLeft: vi.fn(),
}));

vi.mock("../auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../useGameTimer", () => ({
  useGameTimer: vi.fn(),
}));

vi.mock("../useHostMessages", () => ({
  useHostMessages: vi.fn(),
}));

/* ── Post-mock imports ───────────────────────────────────────────── */

import { api } from "../api";
import { getSocket, disconnectRoom } from "../socket";
import { useAuth } from "../auth";
import { useGameTimer } from "../useGameTimer";
import { useHostMessages } from "../useHostMessages";

/* ── Factories ───────────────────────────────────────────────────── */

function makeRoom(overrides: Partial<RoomInfo> = {}): RoomInfo {
  return {
    id: "room-1",
    code: "ABC123",
    mode: "solo",
    timer: 30,
    status: "waiting",
    player_count: 0,
    total_questions: 10,
    players: [],
    ...overrides,
  };
}

function makeQuestionResponse(overrides: Record<string, unknown> = {}) {
  const baseQuestion = {
    text: "Sample question?",
    difficulty: "EASY",
    choices: [
      { text: "Alpha" },
      { text: "Beta" },
      { text: "Gamma" },
      { text: "Delta" },
    ],
    mediaUrl: null,
    mediaType: null,
    explanation: null,
    sourceUrl: null,
  };
  const mergedQuestion = {
    ...baseQuestion,
    ...((overrides.question as object) || {}),
  };
  const { question: _omit, ...restOverrides } = overrides;
  return {
    question: mergedQuestion,
    correctCount: 1,
    ...restOverrides,
  };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function triggerSocketEvent(event: string, ...args: any[]) {
  const handler = socketHandlers[event];
  if (handler) handler(...args);
}

/** Reset the api mock to return a consistent resolved value. */
function setApiDefault(data: unknown) {
  (api as unknown as ReturnType<typeof vi.fn>).mockReset();
  (api as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(data);
}

/** Set api to hang indefinitely (never resolves). */
function hangApi() {
  (api as unknown as ReturnType<typeof vi.fn>).mockReset();
  (api as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    new Promise(() => {}),
  );
}

/* ── Suite ───────────────────────────────────────────────────────── */

describe("useRoomGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear socket handler registry so each test starts fresh
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
    sessionStorage.clear();
    // Re‑establish default return values for mocked hooks
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      loading: false,
    });
    (useGameTimer as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      timeLeft: 0,
      feedbackCountdown: 0,
      clearTimer: vi.fn(),
      clearFeedbackTimer: vi.fn(),
      startFeedbackCountdown: vi.fn(),
      timerExpired: false,
    });
    (useHostMessages as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      hostMessage: "",
      hostExpression: "smile" as const,
    });
  });

  // ─── 1. INITIAL STATE ─────────────────────────────────────────────

  it("returns default state before room data loads", () => {
    hangApi();

    const { result } = renderHook(() => useRoomGame("room-1"));

    expect(result.current.room).toBeNull();
    expect(result.current.phase).toBe("pre-game");
    expect(result.current.error).toBe("");
    expect(result.current.joined).toBe(false);
    expect(result.current.nickname).toBe("");
    expect(result.current.playerId).toBe("");
    expect(result.current.isFeedback).toBe(false);
    expect(result.current.hasAnswered).toBe(false);
    expect(result.current.answeredCount).toBe(0);
    expect(result.current.totalActive).toBe(0);
    expect(result.current.creatorPid).toBeNull();
    expect(result.current.soloStarting).toBe(false);
    expect(result.current.joining).toBe(false);
    expect(result.current.isReplaying).toBe(false);
    expect(result.current.isReady).toBe(false);
  });

  // ─── 2. ROOM FETCH ON MOUNT ──────────────────────────────────────

  it("fetches room on mount and populates state", async () => {
    const room = makeRoom({ player_count: 2, mode: "solo" });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    expect(api).toHaveBeenCalledWith("/rooms/room-1");
    expect(result.current.phase).toBe("pre-game");
    expect(result.current.error).toBe("");
  });

  it("sets error when room fetch fails", async () => {
    (api as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found"),
    );

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.error).toBe("room.not_found");
    });
    expect(result.current.room).toBeNull();
  });

  it("pre-fills nickname from authenticated user", async () => {
    hangApi(); // room will never load; we only test the nickname effect

    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: {
        pseudo: "Alice",
        id: "u1",
        email: "a@b.com",
        role: "USER",
        language: "fr",
        theme: "light",
      },
      loading: false,
    });

    // Re-render so the useEffect picks up the new user value
    const { result, rerender } = renderHook((id: string) => useRoomGame(id), {
      initialProps: "room-1",
    });

    // Need a render cycle for the user effect to fire
    rerender("room-1");

    await waitFor(() => {
      expect(result.current.nickname).toBe("Alice");
    });
  });

  // ─── 3. JOIN FLOW ────────────────────────────────────────────────

  it("handleJoin calls API and socket emit, and updates state", async () => {
    const room = makeRoom();
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    act(() => {
      result.current.setNickname("Bob");
    });

    await act(async () => {
      await result.current.handleJoin();
    });

    // POST join endpoint
    expect(api).toHaveBeenCalledWith(
      "/rooms/room-1/join",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Bob"),
      }),
    );
    // socket emit
    expect(mockSocket.emit).toHaveBeenCalledWith("player-joined", {
      roomId: "room-1",
      playerId: expect.stringContaining("Bob"),
      nickname: "Bob",
    });

    expect(result.current.joined).toBe(true);
    expect(result.current.nickname).toBe("Bob");
    expect(result.current.joining).toBe(false);
  });

  it("does not join without a nickname", async () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).not.toBeNull());

    // nickname is empty string
    act(() => {
      result.current.handleJoin();
    });

    // Only the mount fetch happened
    expect(api).toHaveBeenCalledTimes(1);
    expect(result.current.joined).toBe(false);
  });

  it("sets error when join API fails", async () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => {
      result.current.setNickname("Bob");
    });

    (api as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      "Room full", // string, not Error – formatError returns the fallback
    );

    await act(async () => {
      await result.current.handleJoin();
    });

    expect(result.current.error).toBe("room.join_failed");
    expect(result.current.joined).toBe(false);
  });

  // ─── 4. SOLO START ───────────────────────────────────────────────

  it("handleSoloStart joins, starts game, and transitions to game phase", async () => {
    const room = makeRoom({ mode: "solo" });
    const currentQ = { question_id: 42, index: 0 };
    const qResp = makeQuestionResponse();

    // Sequence:
    //   1. mount → GET /rooms/room-1          → room
    //   2. soloStart → POST /rooms/room-1/join → any
    //   3. start → POST /rooms/room-1/start…   → any
    //   4. fetchQuestion → GET /rooms/room-1/current-question/… → currentQ
    //   5. fetchQuestion → GET /questions/42?game=true          → qResp
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(currentQ)
      .mockResolvedValueOnce(qResp);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    await act(async () => {
      await result.current.handleSoloStart();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("game");
    });

    expect(result.current.joined).toBe(true);
    expect(result.current.questionText).toBe("Sample question?");
    expect(result.current.questionId).toBe(42);
    expect(result.current.questionIndex).toBe(0);
    expect(result.current.questionDifficulty).toBe("EASY");
    expect(result.current.questionCorrectCount).toBe(1);
    expect(result.current.soloStarting).toBe(false);
    // Socket should have emitted both player-joined and game-started
    expect(mockSocket.emit).toHaveBeenCalledWith("player-joined", {
      roomId: "room-1",
      playerId: expect.any(String),
      nickname: expect.any(String),
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("game-started", {
      roomId: "room-1",
    });
  });

  it("does not double-start when soloStarting is true", async () => {
    setApiDefault(makeRoom({ mode: "solo" }));

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).not.toBeNull());

    // Hitting handleSoloStart while join already happened
    act(() => {
      result.current.setNickname("Solo");
    });

    // First call — will start (but we hang the join API so it stays in soloStarting)
    (api as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    // Fire handleSoloStart (doesn't await because promise never resolves)
    act(() => {
      result.current.handleSoloStart();
    });

    // Second call should bail out because soloStarting is true
    const callsBefore = (api as unknown as ReturnType<typeof vi.fn>).mock.calls
      .length;
    await act(async () => {
      await result.current.handleSoloStart();
    });

    // No additional API calls after the bailed-out start
    expect((api as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsBefore,
    );
  });

  // ─── 5. SOCKET EVENT: game-started ───────────────────────────────

  it("handles game-started: fetches question and transitions to game", async () => {
    const room = makeRoom({ status: "waiting" });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).toEqual(room));

    // Setup the question API responses that fetchQuestion will call
    const currentQ = { question_id: 10, index: 0 };
    const qResp = makeQuestionResponse({
      question: {
        text: "Hard question?",
        difficulty: "HARD",
        choices: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }],
        mediaUrl: null,
        mediaType: null,
        explanation: "Because",
        sourceUrl: null,
      },
    });

    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(currentQ)
      .mockResolvedValueOnce(qResp);

    act(() => {
      triggerSocketEvent("game-started");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("game");
    });

    expect(result.current.questionText).toBe("Hard question?");
    expect(result.current.questionDifficulty).toBe("HARD");
    expect(result.current.questionExplanation).toBe("Because");
    expect(result.current.hasAnswered).toBe(false);
  });

  // ─── 6. SOCKET EVENT: question-feedback ──────────────────────────

  it("handles question-feedback with correct answer", async () => {
    const room = makeRoom({
      status: "playing",
      total_questions: 5,
      players: [
        {
          id: "p1",
          nickname: "Alice",
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
        {
          id: "p2",
          nickname: "Bob",
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
      ],
    });
    // mount fetch + join POST + room re-fetch (from handleJoin)
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    // Join as "Alice" so playerIdRef.current = "p1"
    act(() => {
      result.current.setNickname("Alice");
    });

    await act(async () => {
      await result.current.handleJoin();
    });

    expect(result.current.joined).toBe(true);
    expect(result.current.playerId).toContain("Alice");

    // Start the game
    const currentQ = { question_id: 5, index: 0 };
    const qResp = makeQuestionResponse();
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(currentQ)
      .mockResolvedValueOnce(qResp);

    act(() => {
      triggerSocketEvent("game-started");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("game");
    });

    // Player answers
    act(() => {
      result.current.handleChoice(1);
    });
    act(() => {
      result.current.handleAnswerSubmit();
    });

    // Now trigger question-feedback with player_id matching the
    // playerId that was generated during join
    const actualPlayerId = result.current.playerId;
    const feedback: QuestionFeedbackPayload = {
      question_id: 5,
      correct_choices: [1],
      results: [
        {
          player_id: actualPlayerId,
          nickname: "Alice",
          correct: true,
          points: 15,
          bonus: 0,
          streak: 1,
          cumulative_time: 3.2,
        },
        {
          player_id: "p2",
          nickname: "Bob",
          correct: false,
          points: 0,
          bonus: 0,
          streak: 0,
          cumulative_time: 5.1,
        },
      ],
    };

    act(() => {
      triggerSocketEvent("question-feedback", feedback);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("feedback");
    });

    expect(result.current.isFeedback).toBe(true);
    expect(result.current.result).toEqual({
      correct: true,
      points: 15,
      bonus: 0,
      streak: 1,
      cumulative_time: 3.2,
    });
    expect(result.current.correctCount).toBeGreaterThanOrEqual(1);
    expect(result.current.feedbackMeta.correct).toBe(true);
  });

  it("ignores question-feedback when question_id does not match", async () => {
    const room = makeRoom({ status: "playing" });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).toEqual(room));

    // Trigger game-started to set questionIdRef.current = 5
    const currentQ = { question_id: 5, index: 0 };
    const qResp = makeQuestionResponse();
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(currentQ)
      .mockResolvedValueOnce(qResp);

    act(() => {
      triggerSocketEvent("game-started");
    });

    await waitFor(() => expect(result.current.phase).toBe("game"));

    // Feedback with wrong question_id → should be ignored
    act(() => {
      triggerSocketEvent("question-feedback", {
        question_id: 999,
        correct_choices: [],
        results: [],
      });
    });

    // Phase should remain game
    expect(result.current.phase).toBe("game");
  });

  // ─── 7. SOCKET EVENT: next-question ──────────────────────────────

  it("handles next-question: fetches next question while staying in game", async () => {
    const room = makeRoom({ status: "waiting" });
    const q1 = { question_id: 1, index: 0 };
    const q1Resp = makeQuestionResponse({ question: { text: "Q1?" } });
    const q2 = { question_id: 2, index: 1 };
    const q2Resp = makeQuestionResponse({
      question: { text: "Q2?", difficulty: "HARD" },
    });

    // Queue-based mock: each call returns the next item in sequence.
    // This avoids mockResolvedValueOnce interaction quirks.
    const responseQueue: unknown[] = [room, q1, q1Resp, q2, q2Resp];
    (api as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(responseQueue.shift()),
    );

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    // Trigger game-started → fetchQuestion → consumes q1, q1Resp
    act(() => {
      triggerSocketEvent("game-started");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("game");
    });
    expect(result.current.questionText).toBe("Q1?");

    // Trigger next-question → fetchQuestion → consumes q2, q2Resp
    act(() => {
      triggerSocketEvent("next-question");
    });

    await waitFor(() => {
      expect(result.current.questionText).toBe("Q2?");
    });

    expect(result.current.questionId).toBe(2);
    expect(result.current.questionIndex).toBe(1);
    expect(result.current.phase).toBe("game");
    expect(result.current.result).toBeNull();
    expect(result.current.hasAnswered).toBe(false);
    expect(result.current.selectedChoices).toEqual([]);
  });

  // ─── 8. SOCKET EVENT: game-finished ──────────────────────────────

  it("handles game-finished: transitions to end and loads scoreboard", async () => {
    (api as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeRoom({ status: "playing" }),
    );

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).not.toBeNull());

    const mockScoreboard: ScoreboardEntry[] = [
      {
        player_id: "p1",
        nickname: "Alice",
        score: 100,
        streak: 3,
        cumulative_time: 12,
      },
      {
        player_id: "p2",
        nickname: "Bob",
        score: 50,
        streak: 1,
        cumulative_time: 18,
      },
    ];

    (api as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockScoreboard,
    );

    act(() => {
      triggerSocketEvent("game-finished");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("end");
    });

    // loadScoreboard is called via a ref, which may be async; wait for it
    await waitFor(() => {
      expect(result.current.scoreboard).toEqual(mockScoreboard);
    });

    expect(result.current.isFeedback).toBe(false);
  });

  // ─── 9. SOCKET EVENT: player events (joined / left / answered) ───

  it("handles player-joined socket event", async () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => {
      triggerSocketEvent("player-joined", {
        playerId: "p3",
        nickname: "Charlie",
      });
    });

    expect(result.current.room?.players).toHaveLength(1);
    expect(result.current.room?.players[0].nickname).toBe("Charlie");
    expect(result.current.room?.player_count).toBe(1);
  });

  it("handles player-left socket event", async () => {
    const room = makeRoom({
      players: [
        {
          id: "p1",
          nickname: "Alice",
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
      ],
      player_count: 1,
    });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room?.players).toHaveLength(1);
    });

    act(() => {
      triggerSocketEvent("player-left", { playerId: "p1" });
    });

    expect(result.current.room?.players).toHaveLength(0);
    expect(result.current.room?.player_count).toBe(0);
  });

  it("handles player-answered socket event", async () => {
    const room = makeRoom({
      players: [
        {
          id: "p1",
          nickname: "Alice",
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
      ],
      player_count: 1,
    });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room?.players[0].answered).toBe(false);
    });

    act(() => {
      triggerSocketEvent("player-answered", {
        playerId: "p1",
        questionId: 1,
      });
    });

    expect(result.current.room?.players[0].answered).toBe(true);
  });

  // ─── 10. SOCKET EVENT: room-replayed ─────────────────────────────

  it("handles room-replayed: resets state and re-fetches room", async () => {
    const room = makeRoom({ status: "finished" });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).toEqual(room));

    // Change state away from initial to confirm reset
    act(() => {
      result.current.handleToggleReady();
    });
    expect(result.current.isReady).toBe(true);

    // Set api to return the room again for the re-fetch
    (api as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(room);

    act(() => {
      triggerSocketEvent("room-replayed");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("ready");
    });

    expect(result.current.result).toBeNull();
    expect(result.current.scoreboard).toEqual([]);
    expect(result.current.hasAnswered).toBe(false);
    expect(result.current.selectedChoices).toEqual([]);
    expect(result.current.isReady).toBe(false);
    // Room should have been re-fetched
    expect(api).toHaveBeenCalledWith("/rooms/room-1");
  });

  // ─── 11. HANDLER: handleToggleReady ──────────────────────────────

  it("handleToggleReady toggles ready state and emits socket event", () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    expect(result.current.isReady).toBe(false);

    act(() => {
      result.current.handleToggleReady();
    });

    expect(result.current.isReady).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith("player-ready", {
      roomId: "room-1",
      playerId: expect.any(String),
      ready: true,
    });

    act(() => {
      result.current.handleToggleReady();
    });

    expect(result.current.isReady).toBe(false);
    expect(mockSocket.emit).toHaveBeenCalledWith("player-ready", {
      roomId: "room-1",
      playerId: expect.any(String),
      ready: false,
    });
  });

  it("updates readyPlayers set when player-ready socket fires", () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    act(() => {
      triggerSocketEvent("player-ready", {
        playerId: "p1",
        ready: true,
      });
    });

    expect(result.current.readyPlayers.has("p1")).toBe(true);

    act(() => {
      triggerSocketEvent("player-ready", {
        playerId: "p1",
        ready: false,
      });
    });

    expect(result.current.readyPlayers.has("p1")).toBe(false);
  });

  // ─── 12. HANDLER: handleChoice ───────────────────────────────────

  it("handleChoice toggles selection (single-correct → radio)", () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    // Select idx 2
    act(() => {
      result.current.handleChoice(2);
    });
    expect(result.current.selectedChoices).toEqual([2]);

    // Toggle same idx → deselects (single-correct: clicking again clears)
    act(() => {
      result.current.handleChoice(2);
    });
    expect(result.current.selectedChoices).toEqual([]);

    // Select 0 then 1 → replaces (radio behavior)
    act(() => {
      result.current.handleChoice(0);
    });
    expect(result.current.selectedChoices).toEqual([0]);

    act(() => {
      result.current.handleChoice(1);
    });
    expect(result.current.selectedChoices).toEqual([1]);
  });

  it("ignores handleChoice when hasAnswered is true", () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    act(() => {
      result.current.handleChoice(0);
    });
    expect(result.current.selectedChoices).toEqual([0]);

    // Submit answer
    act(() => {
      result.current.handleAnswerSubmit();
    });

    // Try to change choice
    act(() => {
      result.current.handleChoice(1);
    });
    // Should still be the original choice
    expect(result.current.selectedChoices).toEqual([0]);
  });

  // ─── 13. HANDLER: handleAnswerSubmit ─────────────────────────────

  it("handleAnswerSubmit emits answer and transitions to feedback in solo", async () => {
    const room = makeRoom({ mode: "solo" });
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(undefined); // for submitAnswer's emit

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room?.mode).toBe("solo");
    });

    act(() => {
      result.current.handleChoice(2);
    });

    act(() => {
      result.current.handleAnswerSubmit();
    });

    expect(result.current.hasAnswered).toBe(true);
    expect(result.current.phase).toBe("feedback");
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "answer",
      expect.objectContaining({
        roomId: "room-1",
        selectedChoices: expect.any(Array),
      }),
    );
  });

  // ─── 14. COMPUTED VALUES ─────────────────────────────────────────

  it("computes answeredCount and totalActive from room.players", async () => {
    const room = makeRoom({
      players: [
        {
          id: "p1",
          nickname: "A",
          score: 0,
          finished: false,
          disconnected: false,
          answered: true,
        },
        {
          id: "p2",
          nickname: "B",
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
        {
          id: "p3",
          nickname: "C",
          score: 0,
          finished: false,
          disconnected: true,
          answered: false,
        },
      ],
      player_count: 3,
    });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.answeredCount).toBe(1);
      expect(result.current.totalActive).toBe(2);
    });
  });

  it("computes perfectScore when correctCount equals total_questions", async () => {
    const room = makeRoom({ mode: "solo", total_questions: 3 });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => expect(result.current.room).toEqual(room));

    // Simulate 3 correct answers via question-feedback events
    const currentQ = { question_id: 1, index: 0 };
    const qResp = makeQuestionResponse();
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(currentQ)
      .mockResolvedValueOnce(qResp);

    act(() => {
      triggerSocketEvent("game-started");
    });

    await waitFor(() => expect(result.current.phase).toBe("game"));

    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.handleChoice(0);
      });
      act(() => {
        result.current.handleAnswerSubmit();
      });

      act(() => {
        triggerSocketEvent("question-feedback", {
          question_id: currentQ.question_id,
          correct_choices: [0],
          results: [
            {
              player_id: result.current.playerId || "",
              nickname: "",
              correct: true,
              points: 10,
              bonus: 0,
              streak: i + 1,
              cumulative_time: 2,
            },
          ],
        });
      });

      if (i < 2) {
        // Advance to next question
        const nextQ = {
          question_id: currentQ.question_id + 1,
          index: i + 1,
        };
        (api as unknown as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce(nextQ)
          .mockResolvedValueOnce(qResp);

        act(() => {
          triggerSocketEvent("next-question");
        });

        await waitFor(() =>
          expect(result.current.questionId).toBe(currentQ.question_id + 1),
        );
        currentQ.question_id++;
      }
    }

    // Now we have correctCount = 3, total_questions = 3
    expect(result.current.correctCount).toBe(3);
    // Need to be in end phase for the effect to be visible...
    // actually perfectScore is just computed from the values
    expect(result.current.perfectScore).toBe(true);
  });

  // ─── 15. getChoiceStyle ──────────────────────────────────────────

  it("getChoiceStyle returns correct CSS classes by state", () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    // Correct choice → emerald
    const s1 = result.current.getChoiceStyle(0, [0, 2], [true, false, false]);
    expect(s1).toContain("bg-emerald-100");

    // Selected but wrong → rose
    const s2 = result.current.getChoiceStyle(1, [1], [false, false, false]);
    expect(s2).toContain("bg-rose-100");

    // Not selected and not correct → neutral
    const s3 = result.current.getChoiceStyle(2, [0], [true, false, false]);
    expect(s3).toContain("bg-white");
  });

  // ─── 16. ERROR HANDLING: answer-error ────────────────────────────

  it("sets error on answer-error socket event", () => {
    setApiDefault(makeRoom());

    const { result } = renderHook(() => useRoomGame("room-1"));

    act(() => {
      triggerSocketEvent("answer-error", { error: "Too late!" });
    });

    expect(result.current.error).toBe("Too late!");
  });

  it("ignores answer-error when already in feedback phase", () => {
    setApiDefault(makeRoom({ mode: "solo" }));

    const { result } = renderHook(() => useRoomGame("room-1"));

    // Force into feedback phase
    act(() => {
      triggerSocketEvent("question-feedback", {
        question_id: 99,
        correct_choices: [],
        results: [],
      });
    });

    act(() => {
      triggerSocketEvent("answer-error", { error: "Too late!" });
    });

    expect(result.current.error).toBe("");
  });

  // ─── 17. CLEANUP ─────────────────────────────────────────────────

  it("disconnects socket on unmount", () => {
    setApiDefault(makeRoom());

    const { unmount } = renderHook(() => useRoomGame("room-1"));

    unmount();

    expect(disconnectRoom).toHaveBeenCalledWith("room-1");
  });

  it("calls getSocket with roomId on mount", () => {
    setApiDefault(makeRoom());

    renderHook(() => useRoomGame("room-1"));

    expect(getSocket).toHaveBeenCalledWith("room-1");
    expect(mockSocket.emit).toHaveBeenCalledWith("join-room", "room-1");
  });

  // ─── 18. HANDLER: handlePlayAgain (solo) ──────────────────────────

  it("handlePlayAgain replays and restarts solo game", async () => {
    const room = makeRoom({ mode: "solo", status: "finished" });
    const currentQ = { question_id: 1, index: 0 };
    const qResp = makeQuestionResponse();

    // Sequence: mount GET → replay POST → start POST → current-question GET → question GET
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(room)      // mount fetch
      .mockResolvedValueOnce(undefined)  // replay POST
      .mockResolvedValueOnce(undefined)  // start POST
      .mockResolvedValueOnce(currentQ)   // current-question GET
      .mockResolvedValueOnce(qResp);     // question GET

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    await act(async () => {
      await result.current.handlePlayAgain();
    });

    // Phase transitions to game after fetchQuestion
    await waitFor(() => {
      expect(result.current.phase).toBe("game");
    });

    // 1. Replay API called
    expect(api).toHaveBeenCalledWith("/rooms/room-1/replay", {
      method: "POST",
    });
    // 2. Start API called
    expect(api).toHaveBeenCalledWith(
      "/rooms/room-1/start?player_id=",
      { method: "POST" },
    );
    // 3. Socket emitted game-started
    expect(mockSocket.emit).toHaveBeenCalledWith("game-started", {
      roomId: "room-1",
    });
    // 4. Error is empty
    expect(result.current.error).toBe("");
    // 5. isReplaying reset
    expect(result.current.isReplaying).toBe(false);
    // 6. Question data loaded
    expect(result.current.questionText).toBe("Sample question?");
  });

  // ─── 19. TIMER EXPIRY ─────────────────────────────────────────────

  it("submits empty answer when timer expires", async () => {
    // Capture the onExpire callback that useGameTimer receives
    let onExpireCapture: (() => void) | null = null;
    (useGameTimer as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (config: { onExpire: () => void }) => {
        onExpireCapture = config.onExpire;
        return {
          timeLeft: 0,
          timerExpired: false,
          clearTimer: vi.fn(),
          clearFeedbackTimer: vi.fn(),
          startFeedbackCountdown: vi.fn(),
          feedbackCountdown: 0,
        };
      },
    );

    const room = makeRoom({ mode: "solo", status: "playing" });
    (api as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    // Start the game so we are in "game" phase
    const currentQ = { question_id: 5, index: 0 };
    const qResp = makeQuestionResponse();
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(currentQ)
      .mockResolvedValueOnce(qResp);

    act(() => {
      triggerSocketEvent("game-started");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("game");
    });

    // Simulate timer expiry by invoking the captured callback
    act(() => {
      onExpireCapture!();
    });

    // Answer was submitted with empty choices
    expect(result.current.hasAnswered).toBe(true);
    expect(result.current.phase).toBe("feedback");
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "answer",
      expect.objectContaining({
        roomId: "room-1",
        selectedChoices: [],
      }),
    );
  });

  // ─── 20. RECONNECTION ─────────────────────────────────────────────

  it("reads stored session data and pre-populates state for reconnection", async () => {
    const storedPid = "alice-reconnect-456";
    const storedNick = "Alice";
    sessionStorage.setItem("player-room-1", storedPid);
    sessionStorage.setItem("nickname-room-1", storedNick);

    const room = makeRoom({
      players: [
        {
          id: storedPid,
          nickname: storedNick,
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
      ],
      player_count: 1,
    });
    setApiDefault(room);

    const { result } = renderHook(() => useRoomGame("room-1"));

    // Initial state reads from sessionStorage (useState initializer)
    expect(result.current.playerId).toBe(storedPid);
    expect(result.current.nickname).toBe(storedNick);

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    // Socket was set up
    expect(getSocket).toHaveBeenCalledWith("room-1");

    // The hook state is ready for reconnection via handleJoin
    // (playerId and nickname are pre-filled from sessionStorage)
  });

  it("reconnects via handleJoin using pre-populated playerId from sessionStorage", async () => {
    const storedPid = "bob-reconnect-789";
    const storedNick = "Bob";
    sessionStorage.setItem("player-room-1", storedPid);
    sessionStorage.setItem("nickname-room-1", storedNick);

    const room = makeRoom({
      players: [
        {
          id: storedPid,
          nickname: storedNick,
          score: 0,
          finished: false,
          disconnected: false,
          answered: false,
        },
      ],
      player_count: 1,
    });
    // mount fetch → join POST → room re-fetch
    (api as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(undefined) // join POST
      .mockResolvedValueOnce(room);     // room re-fetch after join

    const { result } = renderHook(() => useRoomGame("room-1"));

    await waitFor(() => {
      expect(result.current.room).toEqual(room);
    });

    // handleJoin should use the pre-populated playerId from sessionStorage
    await act(async () => {
      await result.current.handleJoin();
    });

    expect(result.current.joined).toBe(true);
    expect(result.current.playerId).toBe(storedPid);
    expect(result.current.nickname).toBe(storedNick);

    // Join API was called with the stored player_id and nickname
    expect(api).toHaveBeenCalledWith(
      "/rooms/room-1/join",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(storedPid),
      }),
    );
    // Socket emitted player-joined with the stored data
    expect(mockSocket.emit).toHaveBeenCalledWith("player-joined", {
      roomId: "room-1",
      playerId: storedPid,
      nickname: storedNick,
    });
  });
});
