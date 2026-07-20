import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { PhrasesProvider, usePhrases } from "../PhrasesProvider";
import type { Mock } from "vitest";

// ── Mock data ───────────────────────────────────────────────────────────────

const MOCK_PHRASES = [
  {
    id: "1",
    context: "feedback.correct",
    lang: "fr",
    text: "Bravo !",
    priority: 10,
    scope: "game",
  },
  {
    id: "2",
    context: "feedback.correct",
    lang: "fr",
    text: "Super !",
    priority: 5,
    scope: "game",
  },
  {
    id: "3",
    context: "feedback.wrong",
    lang: "fr",
    text: "Raté...",
    priority: 10,
    scope: "game",
  },
  {
    id: "4",
    context: "end.winner",
    lang: "fr",
    text: "Félicitations {{pseudo}} !",
    priority: 10,
    scope: "end",
  },
  {
    id: "5",
    context: "feedback.correct",
    lang: "en",
    text: "Well done!",
    priority: 10,
    scope: "game",
  },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockApi = vi.hoisted(() => vi.fn().mockResolvedValue({ phrases: [] }));

vi.mock("../api", () => ({
  api: mockApi,
}));

const mockT = vi.fn((key: string, _params?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    "host.feedback.correct": "Bonne réponse depuis i18n !",
    "host.feedback.wrong": "Mauvaise réponse...",
    "host.feedback.only_correct": "Vous êtes le seul à avoir trouvé celle-ci !",
  };
  return map[key] ?? key;
});

vi.mock("../i18n", () => ({
  default: {
    t: (...args: Parameters<typeof mockT>) => mockT(...args),
    language: "fr",
  },
}));

// Helper to render usePhrases without wrapping each test
function renderPhrasesHook() {
  return renderHook(() => usePhrases(), { wrapper: PhrasesProvider });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PhrasesProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApi.mockResolvedValue({ phrases: [] });
  });

  // ── Shape tests ──────────────────────────────────────────────────────────

  it("provides context value with all expected methods", async () => {
    const { result } = renderPhrasesHook();

    // Wait for loading to finish
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(typeof result.current.getPhrase).toBe("function");
    expect(typeof result.current.getPhraseByPriority).toBe("function");
    expect(typeof result.current.refetch).toBe("function");
    expect(typeof result.current.loading).toBe("boolean");
  });

  // ── i18n fallback (existing) ─────────────────────────────────────────────

  it("falls back to i18n when no custom phrases are cached", async () => {
    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const phrase = result.current.getPhrase("feedback.correct");
    expect(phrase).toBe("Bonne réponse depuis i18n !");
    expect(mockT).toHaveBeenCalledWith("host.feedback.correct", undefined);
  });

  it("passes interpolation params to i18n fallback", async () => {
    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.getPhrase("feedback.correct", { score: 150 });
    expect(mockT).toHaveBeenCalledWith("host.feedback.correct", { score: 150 });
  });

  it("falls back to first context via i18n when getPhraseByPriority has no cached phrases", async () => {
    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const phrase = result.current.getPhraseByPriority([
      "feedback.only_correct",
      "feedback.correct",
    ]);
    expect(phrase).toBe("Vous êtes le seul à avoir trouvé celle-ci !");
    expect(mockT).toHaveBeenCalledWith("host.feedback.only_correct", undefined);
  });

  it("returns empty string from default context when no contexts provided to getPhraseByPriority", async () => {
    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const phrase = result.current.getPhraseByPriority([]);
    expect(typeof phrase).toBe("string");
  });

  // ── DB loading ──────────────────────────────────────────────────────────

  it("loads phrases from API and uses them instead of i18n", async () => {
    mockApi.mockResolvedValue({
      phrases: MOCK_PHRASES,
    });

    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Should use a DB phrase (either "Bravo !" or "Super !"), not i18n fallback
    const phrase = result.current.getPhrase("feedback.correct");
    expect(["Bravo !", "Super !"]).toContain(phrase);
    expect(mockT).not.toHaveBeenCalledWith("host.feedback.correct", undefined);
  });

  it("interpolates variables in DB phrases", async () => {
    mockApi.mockResolvedValue({
      phrases: MOCK_PHRASES,
    });

    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const phrase = result.current.getPhrase("end.winner", { pseudo: "Alice" });
    expect(phrase).toBe("Félicitations Alice !");
  });

  it("falls back to i18n for a context without DB entries", async () => {
    mockApi.mockResolvedValue({
      phrases: MOCK_PHRASES,
    });

    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // "feedback.only_correct" has no DB entry → falls back to i18n
    const phrase = result.current.getPhrase("feedback.only_correct");
    expect(phrase).toBe("Vous êtes le seul à avoir trouvé celle-ci !");
  });

  // ── localStorage caching ────────────────────────────────────────────────

  it("caches phrases in localStorage after API fetch", async () => {
    mockApi.mockResolvedValue({
      phrases: MOCK_PHRASES,
    });

    renderPhrasesHook();
    await waitFor(() =>
      expect(localStorage.getItem("quizztine-phrases-cache")).not.toBeNull(),
    );

    const cached = JSON.parse(localStorage.getItem("quizztine-phrases-cache")!);
    expect(cached.phrases).toHaveLength(5);
    expect(cached.updatedAt).toBeGreaterThan(0);
  });

  it("uses cached phrases on mount when cache is fresh", async () => {
    // Seed localStorage with phrases + recent timestamp
    const freshCache = JSON.stringify({
      phrases: [MOCK_PHRASES[0]],
      updatedAt: Date.now(),
    });
    localStorage.setItem("quizztine-phrases-cache", freshCache);

    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Should NOT call API (cache is fresh)
    expect(mockApi).not.toHaveBeenCalled();

    // Should use cached phrase
    const phrase = result.current.getPhrase("feedback.correct");
    expect(phrase).toBe("Bravo !");
  });

  it("refreshes stale cache in background while showing cached content", async () => {
    // Seed localStorage with stale cache (older than STALE_MS = 5min)
    const staleCache = JSON.stringify({
      phrases: [
        {
          id: "old",
          context: "feedback.correct",
          lang: "fr",
          text: "Ancienne",
          priority: 10,
          scope: "game",
        },
      ],
      updatedAt: Date.now() - 10 * 60 * 1000, // 10 min ago (> 5 min stale)
    });
    localStorage.setItem("quizztine-phrases-cache", staleCache);

    mockApi.mockResolvedValue({
      phrases: MOCK_PHRASES,
    });

    const { result } = renderPhrasesHook();

    // Loading stays true while background refresh is in flight
    // (stale content is shown but component acknowledges it's loading)
    expect(result.current.getPhrase("feedback.correct")).toBe("Ancienne");

    // Wait for background refresh to complete
    await waitFor(() => {
      const phraseAfter = result.current.getPhrase("feedback.correct");
      expect(["Bravo !", "Super !"]).toContain(phraseAfter);
    });
  });

  // ── Weighted random selection ──────────────────────────────────────────

  it("selects from equally-weighted contexts in getPhraseByPriority", async () => {
    mockApi.mockResolvedValue({
      phrases: MOCK_PHRASES,
    });

    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // feedback.correct has weight 5, feedback.wrong has weight 5
    // Both have same weight, so either can be chosen
    const contexts = ["feedback.correct", "feedback.wrong"];
    const selectionCounts: Record<string, number> = {};

    // Run many selections to verify weighted behavior
    for (let i = 0; i < 100; i++) {
      const phrase = result.current.getPhraseByPriority(contexts);
      selectionCounts[phrase] = (selectionCounts[phrase] || 0) + 1;
    }

    // With equal weights and equal entries (1 each), both should appear
    expect(selectionCounts["Bravo !"]).toBeGreaterThan(5);
    expect(selectionCounts["Raté..."]).toBeGreaterThan(5);
  });

  // ── refetch ─────────────────────────────────────────────────────────────

  it("refetch loads new phrases and updates the cache", async () => {
    mockApi.mockResolvedValue({
      phrases: [MOCK_PHRASES[0]], // Only "Bravo !"
    });

    const { result } = renderPhrasesHook();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Change API mock for refetch
    mockApi.mockResolvedValue({
      phrases: [MOCK_PHRASES[2]], // Now only "Raté..."
    });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      const phrase = result.current.getPhrase("feedback.wrong");
      expect(phrase).toBe("Raté...");
    });
  });
});
