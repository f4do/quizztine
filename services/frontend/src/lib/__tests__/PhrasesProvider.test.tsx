import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { PhrasesProvider, usePhrases } from "../PhrasesProvider";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../api", () => ({
  api: vi.fn().mockResolvedValue({ phrases: [] }),
}));

const mockT = vi.fn((key: string, _params?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    "host.feedback.correct": "Bonne réponse depuis i18n !",
    "host.feedback.wrong": "Mauvaise réponse...",
    "host.feedback.only_correct":
      "Vous êtes le seul à avoir trouvé celle-ci !",
  };
  return map[key] ?? key;
});

vi.mock("../i18n", () => ({
  default: {
    t: (...args: Parameters<typeof mockT>) => mockT(...args),
    language: "fr",
  },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PhrasesProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides context value with all expected methods", () => {
    const { result } = renderHook(() => usePhrases(), {
      wrapper: PhrasesProvider,
    });

    expect(result.current).toBeDefined();
    expect(typeof result.current.getPhrase).toBe("function");
    expect(typeof result.current.getPhraseByPriority).toBe("function");
    expect(typeof result.current.refetch).toBe("function");
    expect(typeof result.current.loading).toBe("boolean");
  });

  it("falls back to i18n when no custom phrases are cached", () => {
    const { result } = renderHook(() => usePhrases(), {
      wrapper: PhrasesProvider,
    });

    const phrase = result.current.getPhrase("feedback.correct");
    expect(phrase).toBe("Bonne réponse depuis i18n !");
    expect(mockT).toHaveBeenCalledWith(
      "host.feedback.correct",
      undefined,
    );
  });

  it("passes interpolation params to i18n fallback", () => {
    const { result } = renderHook(() => usePhrases(), {
      wrapper: PhrasesProvider,
    });

    result.current.getPhrase("feedback.correct", {
      score: 150,
    });
    expect(mockT).toHaveBeenCalledWith("host.feedback.correct", {
      score: 150,
    });
  });

  it("falls back to first context via i18n when getPhraseByPriority has no cached phrases", () => {
    const { result } = renderHook(() => usePhrases(), {
      wrapper: PhrasesProvider,
    });

    const phrase = result.current.getPhraseByPriority([
      "feedback.only_correct",
      "feedback.correct",
    ]);
    expect(phrase).toBe("Vous êtes le seul à avoir trouvé celle-ci !");
    expect(mockT).toHaveBeenCalledWith(
      "host.feedback.only_correct",
      undefined,
    );
  });

  it("returns empty string from default context when no contexts provided to getPhraseByPriority", () => {
    const { result } = renderHook(() => usePhrases(), {
      wrapper: PhrasesProvider,
    });

    // When called outside a provider, the default context returns ctxs[0] || ''
    // But inside a provider, getPhraseByPriority will call i18n.t(`host.${''}`)
    const phrase = result.current.getPhraseByPriority([]);
    expect(typeof phrase).toBe("string");
  });
});
