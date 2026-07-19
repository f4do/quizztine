import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Phase, FeedbackMeta, ScoreboardEntry } from "./useRoomGameTypes";
import type { HostExpression } from "../components/host/HostPresenter";

export interface UseHostMessagesInput {
  phase: Phase;
  roomMode: string | undefined;
  questionIndex: number;
  questionDifficulty: string | null;
  feedbackMeta: FeedbackMeta;
  timerExpired: boolean;
  scoreboard: ScoreboardEntry[];
  playerId: string;
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
  feedbackMeta,
  timerExpired,
  scoreboard,
  playerId,
}: UseHostMessagesInput): UseHostMessagesReturn {
  const { t } = useTranslation();

  const hostMessage = useMemo(() => {
    if (phase === "pre-game") {
      return roomMode === "solo"
        ? t("host.pre.solo")
        : t("host.pre.welcome");
    }
    if (phase === "game") {
      if (questionDifficulty === "HARD")
        return t("host.question.hard", { index: questionIndex + 1 });
      if (questionDifficulty === "EASY")
        return t("host.question.easy", { index: questionIndex + 1 });
      return t("host.question.default", { index: questionIndex + 1 });
    }
    if (phase === "feedback") {
      if (timerExpired) return t("host.feedback.timeout");
      if (feedbackMeta.correct) {
        if (feedbackMeta.onlyCorrect)
          return t("host.feedback.only_correct");
        if (feedbackMeta.firstCorrect)
          return t("host.feedback.first_correct");
        if (feedbackMeta.difficulty === "HARD")
          return t("host.feedback.correct_hard");
        return t("host.feedback.correct");
      }
      if (feedbackMeta.onlyWrong)
        return t("host.feedback.only_wrong");
      return t("host.feedback.wrong");
    }
    if (phase === "end") {
      const own = scoreboard.find(
        (s) => s.player_id === playerId,
      );
      if (!own) return t("host.end.default");
      if (
        roomMode !== "solo" &&
        scoreboard.length > 0 &&
        scoreboard.every((s) => s.score === 0)
      )
        return t("room.easter_egg");
      if (scoreboard[0]?.player_id === playerId)
        return t("host.end.winner", { score: own.score });
      if (own.score === 0) return t("host.end.low");
      return t("host.end.default", { score: own.score });
    }
    return "";
  }, [
    phase,
    roomMode,
    questionIndex,
    questionDifficulty,
    feedbackMeta,
    timerExpired,
    scoreboard,
    playerId,
    t,
  ]);

  const hostExpression = useMemo(() => {
    if (phase === "end") {
      const own = scoreboard.find(
        (s) => s.player_id === playerId,
      );
      if (own && scoreboard[0]?.player_id === playerId)
        return "applause";
      if (own && own.score === 0) return "console";
      return "smile";
    }
    if (phase === "feedback") {
      if (timerExpired) return "console";
      if (feedbackMeta.correct) return "applause";
      return "console";
    }
    if (phase === "game") return "focused";
    return "smile";
  }, [phase, feedbackMeta, timerExpired, scoreboard, playerId]);

  return { hostMessage, hostExpression };
}
