import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import i18n from "./i18n";
import { api } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────

interface PhraseEntry {
  id: string;
  context: string;
  lang: string;
  text: string;
  priority: number;
  scope: string;
}

interface PhrasesCache {
  phrases: PhraseEntry[];
  updatedAt: number;
}

type PhraseMap = Record<string, PhraseEntry[]>;

interface PhrasesContextValue {
  getPhrase: (
    context: string,
    params?: Record<string, string | number>,
  ) => string;
  getPhraseByPriority: (
    contexts: string[],
    params?: Record<string, string | number>,
  ) => string;
  loading: boolean;
  refetch: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CACHE_KEY = "quizztine-phrases-cache";
const STALE_MS = 5 * 60 * 1000; // 5 minutes

/** Intrinsic weight per context — higher = more likely to be chosen
 *  when multiple contexts match. Set once in code, no admin config needed. */
const CONTEXT_WEIGHTS: Record<string, number> = {
  "feedback.streak_10":          80,
  "feedback.streak_5":           60,
  "feedback.streak_3":           40,
  "feedback.correct_first_only": 35,
  "feedback.only_correct":       25,
  "feedback.first_correct":      20,
  "feedback.correct_hard":       15,
  "feedback.correct":             5,
  "feedback.only_wrong":         25,
  "feedback.streak_lost":        20,
  "feedback.wrong":               5,
  "feedback.timeout":             5,
  "game.first":                  30,
  "game.last":                   30,
  "game.media_audio":            20,
  "game.media_video":            20,
  "question.hard":               15,
  "question.easy":               10,
  "question.default":             5,
  "end.perfect":                 80,
  "end.winner":                  60,
  "end.second":                  30,
  "end.third":                   20,
  "end.tie":                     15,
  "end.last":                    10,
  "end.low":                      8,
  "end.default":                  3,
  "pre.solo":                    10,
  "pre.welcome":                 10,
  "ready.replay":                10,
};

/** Default weight when a context is not in the map */
const DEFAULT_WEIGHT = 10;

// ── Helpers ────────────────────────────────────────────────────────────────

function interpolate(
  text: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = params[key];
    return val != null ? String(val) : `{{${key}}}`;
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPhraseMap(phrases: PhraseEntry[]): PhraseMap {
  const map: PhraseMap = {};
  for (const entry of phrases) {
    const key = `${entry.context}:${entry.lang}`;
    if (!map[key]) map[key] = [];
    map[key].push(entry);
  }
  return map;
}

function loadCache(): { phrases: PhraseEntry[]; updatedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PhrasesCache;
  } catch {
    return null;
  }
}

function saveCache(phrases: PhraseEntry[]): void {
  try {
    const cache: PhrasesCache = { phrases, updatedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.)
  }
}

// ── Context ────────────────────────────────────────────────────────────────

const PhrasesContext = createContext<PhrasesContextValue>({
  getPhrase: (ctx) => ctx,
  getPhraseByPriority: (ctxs) => ctxs[0] || "",
  loading: true,
  refetch: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────

export function PhrasesProvider({ children }: { children: ReactNode }) {
  const [phraseMap, setPhraseMap] = useState<PhraseMap>({});
  const [loading, setLoading] = useState(true);

  // Load from cache on mount, then fetch fresh data in background
  useEffect(() => {
    let cancelled = false;
    const cached = loadCache();

    if (cached) {
      setPhraseMap(buildPhraseMap(cached.phrases));

      // Cache is fresh enough — use it and skip the fetch
      if (Date.now() - cached.updatedAt < STALE_MS) {
        setLoading(false);
        return;
      }

      // Stale cache — use it for instant display, refresh in background
      // Don't set loading=true here; the cache content is already usable
    }

    if (!cached) {
      setLoading(true); // Only show loading when we have no data at all
    }

    (async () => {
      try {
        const data = (await api("/host/phrases")) as {
          phrases: PhraseEntry[];
        };
        if (cancelled) return;
        if (data?.phrases) {
          const map = buildPhraseMap(data.phrases);
          setPhraseMap(map);
          saveCache(data.phrases);
        }
      } catch {
        // Keep existing cache on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Get a random phrase for the given context, falling back to i18n. */
  const getPhrase = useCallback(
    (
      context: string,
      params?: Record<string, string | number>,
    ): string => {
      const lang = i18n.language || "fr";
      const key = `${context}:${lang}`;
      const entries = phraseMap[key];

      if (entries && entries.length > 0) {
        const entry = pickRandom(entries);
        return interpolate(entry.text, params);
      }

      // Fallback to i18n with the "host." prefix convention
      return i18n.t(
        `host.${context}`,
        params as Record<string, unknown>,
      ) as string;
    },
    [phraseMap],
  );

  /**
   * Pick a phrase using weighted random selection among matching contexts.
   * Each context has an intrinsic weight (more specific = higher weight).
   * Falls back to i18n using the first context if nothing is cached.
   */
  const getPhraseByPriority = useCallback(
    (
      contexts: string[],
      params?: Record<string, string | number>,
    ): string => {
      const lang = i18n.language || "fr";

      // Collect matching contexts with their weights
      const candidates: { weight: number; entries: PhraseEntry[] }[] = [];
      for (const context of contexts) {
        const key = `${context}:${lang}`;
        const entries = phraseMap[key];
        if (entries && entries.length > 0) {
          candidates.push({
            weight: CONTEXT_WEIGHTS[context] ?? DEFAULT_WEIGHT,
            entries,
          });
        }
      }

      if (candidates.length > 0) {
        // Weighted random selection
        const totalWeight = candidates.reduce(
          (sum, c) => sum + c.weight,
          0,
        );
        let r = Math.random() * totalWeight;
        for (const candidate of candidates) {
          r -= candidate.weight;
          if (r <= 0) {
            const entry = pickRandom(candidate.entries);
            return interpolate(entry.text, params);
          }
        }
        // Fallback (should not reach here, but just in case)
        const entry = pickRandom(candidates[0].entries);
        return interpolate(entry.text, params);
      }

      // No cached phrases at all — fall back to i18n with the first context
      return i18n.t(
        `host.${contexts[0]}`,
        params as Record<string, unknown>,
      ) as string;
    },
    [phraseMap],
  );

  /** Force-refetch phrases from the backend. */
  const refetch = useCallback(() => {
    setLoading(true);
    (async () => {
      try {
        const data = (await api("/host/phrases")) as {
          phrases: PhraseEntry[];
        };
        if (data?.phrases) {
          const map = buildPhraseMap(data.phrases);
          setPhraseMap(map);
          saveCache(data.phrases);
        }
      } catch {
        // Keep existing cache on failure
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<PhrasesContextValue>(
    () => ({ getPhrase, getPhraseByPriority, loading, refetch }),
    [getPhrase, getPhraseByPriority, loading, refetch],
  );

  return (
    <PhrasesContext.Provider value={value}>
      {children}
    </PhrasesContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePhrases(): PhrasesContextValue {
  const ctx = useContext(PhrasesContext);
  if (!ctx)
    throw new Error("usePhrases must be used within a PhrasesProvider");
  return ctx;
}
