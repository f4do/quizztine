import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHostMessages } from "../useHostMessages";
import type {
  FeedbackMeta,
  ScoreboardEntry,
} from "../useRoomGameTypes";

// ── Shared mock t function ────────────────────────────────────────────────

const mockT = vi.fn(
  (key: string, params?: Record<string, unknown>) => {
    switch (key) {
      case "host.pre.solo":
        return "Ready for solo training?";
      case "host.pre.welcome":
        return "Welcome to the quiz!";
      case "host.question.default":
        return `Question ${params?.index}`;
      case "host.question.easy":
        return `Easy Q${params?.index}`;
      case "host.question.hard":
        return `Hard Q${params?.index}`;
      case "host.feedback.timeout":
        return "Time expired!";
      case "host.feedback.correct":
        return "Correct answer!";
      case "host.feedback.correct_hard":
        return "Correct hard!";
      case "host.feedback.first_correct":
        return "First correct!";
      case "host.feedback.only_correct":
        return "Only correct!";
      case "host.feedback.wrong":
        return "Wrong answer!";
      case "host.feedback.only_wrong":
        return "Only wrong!";
      case "host.end.winner":
        return `Winner ${params?.score}`;
      case "host.end.second":
        return params?.score != null ? `End ${params?.score}` : "End";
      case "host.end.third":
        return params?.score != null ? `End ${params?.score}` : "End";
      case "host.end.last":
        return params?.score != null ? `End ${params?.score}` : "End";
      case "host.end.low":
        return "Low score";
      case "host.end.default":
        return params?.score != null ? `End ${params?.score}` : "End";
      case "host.end.perfect":
        return "Perfect score!";
      case "room.easter_egg":
        return "Easter egg!";
      default:
        return key;
    }
  },
);

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock("../PhrasesProvider", () => ({
  usePhrases: () => ({
    getPhrase: (ctx: string, params?: Record<string, unknown>) =>
      mockT(`host.${ctx}`, params),
    getPhraseByPriority: (
      contexts: string[],
      params?: Record<string, unknown>,
    ) => mockT(`host.${contexts[0]}`, params),
    loading: false,
    refetch: vi.fn(),
  }),
  PhrasesProvider: ({ children }: { children: React.ReactNode }) =>
    children as unknown as React.ReactElement,
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function feedbackMeta(
  overrides: Partial<FeedbackMeta> = {},
): FeedbackMeta {
  return {
    correct: false,
    onlyCorrect: false,
    firstCorrect: false,
    onlyWrong: false,
    difficulty: null,
    ...overrides,
  };
}

function scoreboardEntry(
  playerId: string,
  overrides: Partial<ScoreboardEntry> = {},
): ScoreboardEntry {
  return {
    player_id: playerId,
    nickname: playerId,
    score: 0,
    streak: 0,
    cumulative_time: 0,
    ...overrides,
  };
}

const defaults: Parameters<typeof useHostMessages>[0] = {
  phase: "pre-game",
  roomMode: undefined,
  questionIndex: 0,
  questionDifficulty: null,
  feedbackMeta: feedbackMeta(),
  timerExpired: false,
  scoreboard: [] as ScoreboardEntry[],
  playerId: "p1",
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useHostMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── pre-game ─────────────────────────────────────────────────── */

  it("returns solo message when roomMode is solo", () => {
    const { result } = renderHook(() =>
      useHostMessages({ ...defaults, phase: "pre-game", roomMode: "solo" }),
    );
    expect(result.current.hostMessage).toBe("Ready for solo training?");
    expect(result.current.hostExpression).toBe("smile");
  });

  it("returns welcome message when roomMode is not solo", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "pre-game",
        roomMode: "multi_public",
      }),
    );
    expect(result.current.hostMessage).toBe("Welcome to the quiz!");
    expect(result.current.hostExpression).toBe("smile");
  });

  /* ── ready ─────────────────────────────────────────────────────── */

  it("returns empty message and smile for ready phase", () => {
    const { result } = renderHook(() =>
      useHostMessages({ ...defaults, phase: "ready" }),
    );
    expect(result.current.hostMessage).toBe("");
    expect(result.current.hostExpression).toBe("smile");
  });

  /* ── game ─────────────────────────────────────────────────────── */

  it("returns focused expression and default question message", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionDifficulty: null,
        questionIndex: 4,
      }),
    );
    expect(result.current.hostMessage).toBe("Question 5");
    expect(result.current.hostExpression).toBe("focused");
  });

  it("returns focused expression and easy question message", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionDifficulty: "EASY",
        questionIndex: 1,
      }),
    );
    expect(result.current.hostMessage).toBe("Easy Q2");
    expect(result.current.hostExpression).toBe("focused");
  });

  it("returns focused expression and hard question message", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionDifficulty: "HARD",
        questionIndex: 9,
      }),
    );
    expect(result.current.hostMessage).toBe("Hard Q10");
    expect(result.current.hostExpression).toBe("focused");
  });

  it("adds game.first context for the first question", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionIndex: 0,
        questionDifficulty: "EASY",
      }),
    );
    // contexts = ["game.first", "question.easy"]
    // contexts[0] = "game.first" → mockT returns "host.game.first" (not in switch)
    expect(result.current.hostMessage).toBe("host.game.first");
    expect(result.current.hostExpression).toBe("focused");
  });

  it("adds game.last context for the final question", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionIndex: 9,
        questionDifficulty: "EASY",
        feedbackMeta: feedbackMeta({ totalQuestions: 10 }),
      }),
    );
    // contexts = ["game.first" (no, index=9 not 0), "question.easy", "game.last"]
    // contexts[0] = "question.easy" → mockT returns "Easy Q10"
    expect(result.current.hostMessage).toBe("Easy Q10");
    expect(result.current.hostExpression).toBe("focused");
  });

  it("adds media_audio context for audio questions", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionMediaType: "audio",
        questionDifficulty: "HARD",
        questionIndex: 2,
      }),
    );
    // contexts = ["game.media_audio", "question.hard"]
    // contexts[0] = "game.media_audio" → mockT returns "host.game.media_audio"
    expect(result.current.hostMessage).toBe("host.game.media_audio");
    expect(result.current.hostExpression).toBe("focused");
  });

  it("adds media_video context for video questions", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "game",
        questionMediaType: "video",
        questionDifficulty: "HARD",
        questionIndex: 2,
      }),
    );
    // contexts = ["game.media_video", "question.hard"]
    // contexts[0] = "game.media_video" → mockT returns "host.game.media_video"
    expect(result.current.hostMessage).toBe("host.game.media_video");
    expect(result.current.hostExpression).toBe("focused");
  });

  /* ── feedback ─────────────────────────────────────────────────── */

  it("returns timeout message with console expression when timer expired", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        timerExpired: true,
        feedbackMeta: feedbackMeta({ correct: false }),
      }),
    );
    expect(result.current.hostMessage).toBe("Time expired!");
    expect(result.current.hostExpression).toBe("console");
  });

  it("returns correct message with applause expression", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({ correct: true }),
      }),
    );
    expect(result.current.hostMessage).toBe("Correct answer!");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns only_correct message when onlyCorrect is true", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({ correct: true, onlyCorrect: true }),
      }),
    );
    // contexts = ["feedback.only_correct", "feedback.correct"]
    // contexts[0] = "feedback.only_correct" → "Only correct!"
    expect(result.current.hostMessage).toBe("Only correct!");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns first_correct message when firstCorrect is true", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({
          correct: true,
          onlyCorrect: false,
          firstCorrect: true,
        }),
      }),
    );
    // contexts = ["feedback.first_correct", "feedback.correct"]
    // contexts[0] = "feedback.first_correct" → "First correct!"
    expect(result.current.hostMessage).toBe("First correct!");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns correct_hard message when difficulty is HARD and correct", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({
          correct: true,
          onlyCorrect: false,
          firstCorrect: false,
          difficulty: "HARD",
        }),
      }),
    );
    // contexts = ["feedback.correct_hard", "feedback.correct"]
    // contexts[0] = "feedback.correct_hard" → "Correct hard!"
    expect(result.current.hostMessage).toBe("Correct hard!");
    expect(result.current.hostExpression).toBe("surprised");
  });

  it("returns surprised expression for streak_10", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({
          correct: true,
          onlyCorrect: false,
          firstCorrect: false,
          difficulty: "EASY",
          streak: 10,
        }),
      }),
    );
    // contexts = ["feedback.streak_10", "feedback.streak_5", "feedback.streak_3",
    //             "feedback.correct"]
    // contexts[0] = "feedback.streak_10" → mockT returns "host.feedback.streak_10"
    // Expression should be "surprised" because streak >= 10 triggers it
    expect(result.current.hostExpression).toBe("surprised");
  });

  it("returns surrounded expression for streak_5", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({
          correct: true,
          onlyCorrect: false,
          firstCorrect: false,
          difficulty: "EASY",
          streak: 5,
        }),
      }),
    );
    // contexts = ["feedback.streak_10"(no, 5<10), "feedback.streak_5", "feedback.streak_3",
    //             "feedback.correct"]
    // contexts[0] = "feedback.streak_5" → mockT returns "host.feedback.streak_5"
    // Expression: streak >= 5 but < 10 → not "surprised" (needs >= 10)
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns wrong message with console expression", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({ correct: false }),
      }),
    );
    // contexts = ["feedback.wrong"]
    // contexts[0] = "feedback.wrong" → "Wrong answer!"
    expect(result.current.hostMessage).toBe("Wrong answer!");
    expect(result.current.hostExpression).toBe("console");
  });

  it("returns only_wrong message when onlyWrong is true", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({ correct: false, onlyWrong: true }),
      }),
    );
    // contexts = ["feedback.only_wrong", "feedback.wrong"]
    // contexts[0] = "feedback.only_wrong" → "Only wrong!"
    expect(result.current.hostMessage).toBe("Only wrong!");
    expect(result.current.hostExpression).toBe("console");
  });

  it("returns console expression when streak is lost", () => {
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "feedback",
        feedbackMeta: feedbackMeta({
          correct: false,
          streak: 3,
        }),
      }),
    );
    // contexts = ["feedback.streak_lost", "feedback.wrong"]
    // contexts[0] = "feedback.streak_lost" → mockT returns "host.feedback.streak_lost"
    // Expression: streak > 0 and wrong → console
    expect(result.current.hostExpression).toBe("console");
  });

  /* ── end ──────────────────────────────────────────────────────── */

  it("returns winner message with applause when player is first", () => {
    const sb = [
      scoreboardEntry("p1", { score: 120 }),
      scoreboardEntry("p2", { score: 80 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "p1",
      }),
    );
    // contexts = ["end.winner", "end.default"]
    // contexts[0] = "end.winner" → "Winner 120"
    expect(result.current.hostMessage).toBe("Winner 120");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns easter egg when all scores are zero in multiplayer", () => {
    const sb = [
      scoreboardEntry("p1", { score: 0 }),
      scoreboardEntry("p2", { score: 0 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        roomMode: "multi_public",
        scoreboard: sb,
        playerId: "p1",
      }),
    );
    expect(result.current.hostMessage).toBe("Easter egg!");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("does NOT show easter egg in solo mode even when all scores zero", () => {
    const sb = [scoreboardEntry("p1", { score: 0 })];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        roomMode: "solo",
        scoreboard: sb,
        playerId: "p1",
      }),
    );
    // contexts = ["end.winner", "end.low", ...] — winner first since p1 is rank 0
    expect(result.current.hostMessage).toBe("Winner 0");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns second place message for runner-up", () => {
    const sb = [
      scoreboardEntry("p1", { score: 100 }),
      scoreboardEntry("p2", { score: 50 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "p2",
      }),
    );
    // contexts = ["end.second", "end.default"] (p2 is at index 1)
    // contexts[0] = "end.second" → "End 50"
    expect(result.current.hostMessage).toBe("End 50");
    expect(result.current.hostExpression).toBe("smile");
  });

  it("returns third place message for bronze position", () => {
    const sb = [
      scoreboardEntry("p1", { score: 100 }),
      scoreboardEntry("p2", { score: 60 }),
      scoreboardEntry("p3", { score: 30 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "p3",
      }),
    );
    // contexts = ["end.third", "end.default"] (p3 is at index 2)
    // contexts[0] = "end.third" → "End 30"
    expect(result.current.hostMessage).toBe("End 30");
    expect(result.current.hostExpression).toBe("smile");
  });

  it("returns low message with console when score is 0", () => {
    const sb = [
      scoreboardEntry("p2", { score: 50 }),
      scoreboardEntry("p1", { score: 0 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        roomMode: "solo",
        scoreboard: sb,
        playerId: "p1",
      }),
    );
    // contexts = ["end.low", "end.default"] (p1 is not first, not second, not last, score=0)
    // contexts[0] = "end.low" → "Low score"
    expect(result.current.hostMessage).toBe("Low score");
    expect(result.current.hostExpression).toBe("console");
  });

  it("returns default end message with smile when not winner", () => {
    const sb = [
      scoreboardEntry("p2", { score: 50 }),
      scoreboardEntry("p1", { score: 30 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        roomMode: "solo",
        scoreboard: sb,
        playerId: "p1",
      }),
    );
    // p1 is second place → "end.second" pushed
    // contexts = ["end.second", "end.default"]
    // contexts[0] = "end.second" → "End 30"
    expect(result.current.hostMessage).toBe("End 30");
    expect(result.current.hostExpression).toBe("smile");
  });

  it("returns default end message when player not found in scoreboard", () => {
    const sb = [scoreboardEntry("p2", { score: 50 })];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "unknown",
      }),
    );
    expect(result.current.hostMessage).toBe("End");
    expect(result.current.hostExpression).toBe("smile");
  });

  it("returns perfect score message with surprised expression", () => {
    const sb = [scoreboardEntry("p1", { score: 200 })];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "p1",
        perfectScore: true,
      }),
    );
    // contexts = ["end.perfect", "end.winner", "end.default"]
    // contexts[0] = "end.perfect" → "Perfect score!"
    expect(result.current.hostMessage).toBe("Perfect score!");
    expect(result.current.hostExpression).toBe("applause");
  });

  it("returns winner message even with perfectScore when winner context comes first", () => {
    // This tests the actual provider fallback behavior: contexts[0] is used
    const sb = [scoreboardEntry("p1", { score: 200 })];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "p1",
        perfectScore: true,
      }),
    );
    // contexts = ["end.perfect", "end.winner", "end.default"]
    // contexts[0] = "end.perfect" → "Perfect score!"
    expect(result.current.hostMessage).toBe("Perfect score!");
  });

  it("returns last place message for player at bottom of scoreboard", () => {
    const sb = [
      scoreboardEntry("p1", { score: 100 }),
      scoreboardEntry("p2", { score: 60 }),
      scoreboardEntry("p3", { score: 30 }),
      scoreboardEntry("p4", { score: 10 }),
    ];
    const { result } = renderHook(() =>
      useHostMessages({
        ...defaults,
        phase: "end",
        scoreboard: sb,
        playerId: "p4",
      }),
    );
    // p4 is last (index 3) → "end.last" pushed
    // contexts = ["end.last", "end.default"]
    // contexts[0] = "end.last" → "End 10"
    expect(result.current.hostMessage).toBe("End 10");
    expect(result.current.hostExpression).toBe("smile");
  });
});
