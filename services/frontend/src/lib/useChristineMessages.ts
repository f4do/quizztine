import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Phase, FeedbackMeta, ScoreboardEntry } from "./useRoomGameTypes";
import type { ChristineExpression } from "../components/christine/ChristinePresenter";

export interface UseChristineMessagesInput {
  phase: Phase;
  roomMode: string | undefined;
  questionIndex: number;
  questionDifficulty: string | null;
  feedbackMeta: FeedbackMeta;
  timerExpired: boolean;
  scoreboard: ScoreboardEntry[];
  playerId: string;
}

export interface UseChristineMessagesReturn {
  christineMessage: string;
  christineExpression: ChristineExpression;
}

export function useChristineMessages({
  phase,
  roomMode,
  questionIndex,
  questionDifficulty,
  feedbackMeta,
  timerExpired,
  scoreboard,
  playerId,
}: UseChristineMessagesInput): UseChristineMessagesReturn {
  const { t } = useTranslation();

  const christineMessage = useMemo(() => {
    if (phase === "pre-game") {
      return roomMode === "solo"
        ? t("christine.pre.solo")
        : t("christine.pre.welcome");
    }
    if (phase === "game") {
      if (questionDifficulty === "HARD")
        return t("christine.question.hard", { index: questionIndex + 1 });
      if (questionDifficulty === "EASY")
        return t("christine.question.easy", { index: questionIndex + 1 });
      return t("christine.question.default", { index: questionIndex + 1 });
    }
    if (phase === "feedback") {
      if (timerExpired) return t("christine.feedback.timeout");
      if (feedbackMeta.correct) {
        if (feedbackMeta.onlyCorrect)
          return t("christine.feedback.only_correct");
        if (feedbackMeta.firstCorrect)
          return t("christine.feedback.first_correct");
        if (feedbackMeta.difficulty === "HARD")
          return t("christine.feedback.correct_hard");
        return t("christine.feedback.correct");
      }
      if (feedbackMeta.onlyWrong)
        return t("christine.feedback.only_wrong");
      return t("christine.feedback.wrong");
    }
    if (phase === "end") {
      const own = scoreboard.find(
        (s) => s.player_id === playerId,
      );
      if (!own) return t("christine.end.default");
      if (
        roomMode !== "solo" &&
        scoreboard.length > 0 &&
        scoreboard.every((s) => s.score === 0)
      )
        return t("room.easter_egg");
      if (scoreboard[0]?.player_id === playerId)
        return t("christine.end.winner", { score: own.score });
      if (own.score === 0) return t("christine.end.low");
      return t("christine.end.default", { score: own.score });
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

  const christineExpression = useMemo(() => {
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

  return { christineMessage, christineExpression };
}
