import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePhrases } from "./PhrasesProvider";
import type { Phase, FeedbackMeta, ScoreboardEntry } from "./useRoomGameTypes";
import type { HostExpression } from "../components/host/HostPresenter";

export interface UseHostMessagesInput {
  phase: Phase;
  roomMode: string | undefined;
  questionIndex: number;
  questionDifficulty: string | null;
  questionMediaType?: string | null;
  feedbackMeta: FeedbackMeta;
  timerExpired: boolean;
  timerWarning?: boolean;
  scoreboard: ScoreboardEntry[];
  playerId: string;
  playerPseudo?: string;
  categoryName?: string;
  perfectScore?: boolean;
}

export interface UseHostMessagesReturn {
  hostMessage: string;
  hostExpression: HostExpression;
}

export function useHostMessages({
  phase,
  roomMode,
  questionIndex,
  questionDifficulty,
  questionMediaType,
  feedbackMeta,
  timerExpired,
  timerWarning,
  scoreboard,
  playerId,
  playerPseudo,
  categoryName,
  perfectScore,
}: UseHostMessagesInput): UseHostMessagesReturn {
  const { getPhraseByPriority } = usePhrases();
  // Keep useTranslation ONLY for the easter-egg key (room.*, not host.*)
  const { t } = useTranslation();

  const hostMessage = useMemo(() => {
    /* ── pre-game ─────────────────────────────────────────────────── */
    if (phase === "pre-game") {
      const context = roomMode === "solo" ? "pre.solo" : "pre.welcome";
      return getPhraseByPriority([context]);
    }

    /* ── ready ────────────────────────────────────────────────────── */
    if (phase === "ready") {
      return "";
    }

    /* ── game ─────────────────────────────────────────────────────── */
    if (phase === "game") {
      const params: Record<string, string | number> = {
        index: questionIndex + 1,
        total: feedbackMeta.totalQuestions ?? 0,
        pseudo: playerPseudo ?? "",
        category: categoryName ?? "",
      };
      const contexts: string[] = [];

      // Most specific first
      if (questionIndex === 0) contexts.push("game.first");
      if (questionMediaType === "audio") contexts.push("game.media_audio");
      if (questionMediaType === "video") contexts.push("game.media_video");

      // Difficulty-based (these have i18n equivalents)
      if (questionDifficulty === "HARD") contexts.push("question.hard");
      else if (questionDifficulty === "EASY") contexts.push("question.easy");
      else contexts.push("question.default");

      // Last question marker
      if (
        feedbackMeta.totalQuestions &&
        questionIndex === feedbackMeta.totalQuestions - 1
      ) {
        contexts.push("game.last");
      }

      return getPhraseByPriority(contexts, params);
    }

    /* ── feedback ─────────────────────────────────────────────────── */
    if (phase === "feedback") {
      const contexts: string[] = [];

      // Timer expired is terminal — nothing else matters
      if (timerExpired) {
        contexts.push("feedback.timeout");
        return getPhraseByPriority(contexts, {
          pseudo: playerPseudo ?? "",
          score: feedbackMeta.score ?? 0,
        });
      }

      if (feedbackMeta.correct) {
        const params: Record<string, string | number> = {
          pseudo: playerPseudo ?? "",
          points: feedbackMeta.earnedPoints ?? 0,
          score: feedbackMeta.score ?? 0,
        };
        if (feedbackMeta.streak) params.streak = feedbackMeta.streak;
        if (feedbackMeta.streak) params.streak = feedbackMeta.streak;
        if (feedbackMeta.totalQuestions)
          params.totalQuestions = feedbackMeta.totalQuestions;

        // Streak — un seul palier, pas de cumul
        if (feedbackMeta.streak && feedbackMeta.streak >= 10)
          contexts.push("feedback.streak_10");
        else if (feedbackMeta.streak && feedbackMeta.streak >= 5)
          contexts.push("feedback.streak_5");
        else if (feedbackMeta.streak && feedbackMeta.streak >= 3)
          contexts.push("feedback.streak_3");
        // Multiplayer-only contexts (no meaning in solo)
        const isMulti = roomMode !== "solo";
        if (isMulti && feedbackMeta.onlyCorrect && feedbackMeta.firstCorrect)
          contexts.push("feedback.correct_first_only");
        if (isMulti && feedbackMeta.onlyCorrect)
          contexts.push("feedback.only_correct");
        if (isMulti && feedbackMeta.firstCorrect)
          contexts.push("feedback.first_correct");
        if (feedbackMeta.difficulty === "HARD")
          contexts.push("feedback.correct_hard");
        contexts.push("feedback.correct"); // generic fallback

        return getPhraseByPriority(contexts, params);
      }

      // Wrong answer
      const wrongParams: Record<string, string | number> = {
        pseudo: playerPseudo ?? "",
        score: feedbackMeta.score ?? 0,
      };
      if (feedbackMeta.streak) wrongParams.streak = feedbackMeta.streak;
      if (roomMode !== "solo" && feedbackMeta.onlyWrong) contexts.push("feedback.only_wrong");
      if (feedbackMeta.streak && feedbackMeta.streak > 0)
        contexts.push("feedback.streak_lost");
      contexts.push("feedback.wrong"); // generic fallback

      return getPhraseByPriority(contexts, wrongParams);
    }

    /* ── end ──────────────────────────────────────────────────────── */
    if (phase === "end") {
      const own = scoreboard.find((s) => s.player_id === playerId);

      // Special easter egg: separate from host phrases (room.* i18n key)
      if (
        own &&
        roomMode !== "solo" &&
        scoreboard.length > 0 &&
        scoreboard.every((s) => s.score === 0)
      ) {
        return t("room.easter_egg");
      }

      const params: Record<string, string | number> = {};

      if (own) {
        params.score = own.score;
        params.pseudo = playerPseudo ?? "";
        params.total = feedbackMeta.totalQuestions ?? 0;
        params.correct_count = feedbackMeta.correctCount ?? 0;
        params.rank = (feedbackMeta.rank ?? scoreboard.findIndex(s => s.player_id === playerId) + 1) || 1;

        const contexts: string[] = [];

        if (perfectScore) contexts.push("end.perfect");

        if (scoreboard[0]?.player_id === playerId) {
          // Winner
          contexts.push("end.winner");
        } else {
          // Non-winner position / score-based messages
          const isMulti = roomMode !== "solo";
          if (own.score === 0) {
            contexts.push("end.low");
          } else if (
            isMulti &&
            scoreboard.length >= 2 &&
            scoreboard[1]?.player_id === playerId
          ) {
            contexts.push("end.second");
          } else if (
            isMulti &&
            scoreboard.length >= 3 &&
            scoreboard[2]?.player_id === playerId
          ) {
            contexts.push("end.third");
          } else if (
            isMulti &&
            scoreboard.length > 1 &&
            scoreboard[scoreboard.length - 1]?.player_id === playerId
          ) {
            contexts.push("end.last");
          }
        }

        contexts.push("end.default"); // generic fallback

        return getPhraseByPriority(contexts, params);
      }

      // Player not found in scoreboard
      return getPhraseByPriority(["end.default"], params);
    }

    return "";
  }, [
    phase,
    roomMode,
    questionIndex,
    questionDifficulty,
    questionMediaType,
    feedbackMeta,
    timerExpired,
    timerWarning,
    scoreboard,
    playerId,
    playerPseudo,
    categoryName,
    perfectScore,
    getPhraseByPriority,
    t,
  ]);

  /* ── expression ─────────────────────────────────────────────────── */
  const hostExpression = useMemo(() => {
    if (phase === "end") {
      const own = scoreboard.find((s) => s.player_id === playerId);
      if (own && scoreboard[0]?.player_id === playerId) return "applause";
      if (perfectScore) return "surprised";
      if (own && own.score === 0) return "console";
      return "smile";
    }

    if (phase === "feedback") {
      if (timerExpired) return "console";
      if (feedbackMeta.correct) {
        if (feedbackMeta.difficulty === "HARD") return "surprised";
        if (feedbackMeta.streak && feedbackMeta.streak >= 10)
          return "surprised";
        return "applause";
      }
      // Wrong answer — streak lost is more painful
      if (feedbackMeta.streak && feedbackMeta.streak > 0) return "console";
      return "console";
    }

    if (phase === "game") return "focused";
    return "smile";
  }, [phase, feedbackMeta, timerExpired, scoreboard, playerId, perfectScore]);

  return { hostMessage, hostExpression };
}
