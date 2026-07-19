import { useState, useEffect, useRef, useCallback } from "react";
import type { Phase } from "./useRoomGameTypes";

export interface UseGameTimerInput {
  phase: Phase;
  roomTimer: number;
  questionId: number;
  hasAnswered: boolean;
  onExpire: () => void;
}

export interface UseGameTimerReturn {
  timeLeft: number;
  feedbackCountdown: number;
  clearTimer: () => void;
  clearFeedbackTimer: () => void;
  startFeedbackCountdown: () => void;
  timerExpired: boolean;
}

export function useGameTimer({
  phase,
  roomTimer,
  questionId,
  hasAnswered,
  onExpire,
}: UseGameTimerInput): UseGameTimerReturn {
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [feedbackCountdown, setFeedbackCountdown] = useState(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [timerExpired, setTimerExpired] = useState(false);
  const prevTimeLeft = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearInterval(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  /* ── game timer ────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "game") return;
    setTimeLeft(roomTimer);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, roomTimer, clearTimer]);

  /* ── timer expired detection ───────────────────────────────────── */
  useEffect(() => {
    if (phase !== "game" || questionId === 0 || hasAnswered) return;
    if (prevTimeLeft.current > 0 && timeLeft === 0) {
      setTimerExpired(true);
      onExpire();
    }
    prevTimeLeft.current = timeLeft;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase, questionId]);

  const startFeedbackCountdown = () => {
    setFeedbackCountdown(5);
    feedbackTimerRef.current = setInterval(() => {
      setFeedbackCountdown((prev) => {
        if (prev <= 1) {
          clearFeedbackTimer();
          setFeedbackCountdown(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return {
    timeLeft,
    feedbackCountdown,
    clearTimer,
    clearFeedbackTimer,
    startFeedbackCountdown,
    timerExpired,
  };
}
