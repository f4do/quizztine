import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Socket } from "socket.io-client";
import { api, mediaUrl } from "./api";
import { getSocket, disconnectRoom, emitPlayerLeft } from "./socket";
import { useAuth } from "./auth";
import {
  type RoomInfo,
  type AnswerResult,
  type QuestionFeedbackPayload,
  type ScoreboardEntry,
  type Phase,
  type FeedbackMeta,
  hashStr,
  seededShuffle,
} from "./useRoomGameTypes";
import { useGameTimer } from "./useGameTimer";
import { useHostMessages } from "./useHostMessages";
import type { HostExpression } from "../components/host/HostPresenter";

/* ── Hook return type ──────────────────────────────────────────────── */
export interface UseRoomGameReturn {
  room: RoomInfo | null;
  phase: Phase;
  error: string;
  nickname: string;
  setNickname: (n: string) => void;
  playerId: string;
  joined: boolean;
  questionId: number;
  questionIndex: number;
  questionChoices: { text: string }[];
  questionText: string;
  questionDifficulty: string | null;
  questionMediaUrl: string | null;
  questionMediaType: string | null;
  questionExplanation: string | null;
  questionSourceUrl: string | null;
  questionCorrectCount: number;
  selectedChoices: number[];
  choiceCorrect: boolean[];
  timeLeft: number;
  result: AnswerResult | null;
  scoreboard: ScoreboardEntry[];
  timerExpired: boolean;
  soloStarting: boolean;
  joining: boolean;
  isReplaying: boolean;
  readyPlayers: Set<string>;
  isReady: boolean;
  hasAnswered: boolean;
  feedbackCountdown: number;
  feedbackMeta: FeedbackMeta;
  perfectScore: boolean;
  timerWarning: boolean;
  correctCount: number;
  hostMessage: string;
  hostExpression: HostExpression;
  answeredCount: number;
  totalActive: number;
  isFeedback: boolean;
  creatorPid: string | null;
  handleJoin: () => Promise<void>;
  handleStart: () => Promise<void>;
  handleSoloStart: () => Promise<void>;
  handlePlayAgain: () => Promise<void>;
  handleToggleReady: () => void;
  handleChoice: (idx: number) => void;
  handleAnswerSubmit: () => void;
  getChoiceStyle: (
    idx: number,
    selected: number[],
    correct: boolean[],
  ) => string;
}

/* ── Hook ───────────────────────────────────────────────────────────── */
export function useRoomGame(roomId: string): UseRoomGameReturn {
  const { t } = useTranslation();
  const { user } = useAuth();

  /* ── state ──────────────────────────────────────────────────────── */
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("pre-game");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState(
    () => sessionStorage.getItem(`nickname-${roomId}`) || "",
  );
  const [playerId, setPlayerId] = useState(
    () => sessionStorage.getItem(`player-${roomId}`) || "",
  );
  const [joined, setJoined] = useState(false);

  const [questionId, _setQuestionId] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionChoices, setQuestionChoices] = useState<{ text: string }[]>(
    [],
  );
  const [questionText, setQuestionText] = useState("");
  const [questionDifficulty, setQuestionDifficulty] = useState<string | null>(
    null,
  );
  const [questionMediaUrl, setQuestionMediaUrl] = useState<string | null>(null);
  const [questionMediaType, setQuestionMediaType] = useState<string | null>(
    null,
  );
  const [questionExplanation, setQuestionExplanation] = useState<string | null>(
    null,
  );
  const [questionSourceUrl, setQuestionSourceUrl] = useState<string | null>(
    null,
  );
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const [choiceCorrect, setChoiceCorrect] = useState<boolean[]>([]);
  const [choiceOrder, setChoiceOrder] = useState<number[]>([]);
  const [questionCorrectCount, setQuestionCorrectCount] = useState(1);

  const [result, setResult] = useState<AnswerResult | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [soloStarting, setSoloStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  const [hasAnswered, setHasAnswered] = useState(false);

  const [feedbackMeta, setFeedbackMeta] = useState<FeedbackMeta>({
    correct: false,
    onlyCorrect: false,
    firstCorrect: false,
    onlyWrong: false,
    difficulty: null,
  });

  const [correctCount, setCorrectCount] = useState(0);
  const [timerWarning, setTimerWarning] = useState(false);

  /* ── refs ───────────────────────────────────────────────────────── */
  const socketRef = useRef<Socket | null>(null);
  const questionIdRef = useRef(0);
  const playerIdRef = useRef(playerId);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const choiceOrderRef = useRef<number[]>([]);
  const reconnectRef = useRef<{ pid: string; nickname: string } | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  /* ── custom questionId setter (keeps ref in sync) ──────────────── */
  const setQuestionId = (n: number) => {
    questionIdRef.current = n;
    _setQuestionId(n);
  };

  /* ── creator data from sessionStorage ──────────────────────────── */
  const creatorPid = sessionStorage.getItem(`creatorPid-${roomId}`);
  const creatorNick = sessionStorage.getItem(`creatorNick-${roomId}`);

  /* ── submitAnswer (needed by timer expire & handlers) ──────────── */
  const submitAnswer = useCallback(
    (choices: number[]) => {
      if (!socketRef.current || hasAnswered) return;
      setHasAnswered(true);

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              players: prev.players.map((p) =>
                p.id === playerIdRef.current ? { ...p, answered: true } : p,
              ),
            }
          : prev,
      );
      const dbChoices = choices.map((i) => choiceOrder[i] ?? i);
      socketRef.current.emit("answer", {
        roomId,
        playerId: playerIdRef.current,
        questionId: questionIdRef.current,
        selectedChoices: dbChoices,
        clientTimestamp: Date.now(),
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [roomId, hasAnswered, choiceOrder],
  );

  /* ── timer expire handler (ref to avoid stale closures) ────────── */
  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;
  const setPhaseRef = useRef(setPhase);
  setPhaseRef.current = setPhase;

  const onTimerExpire = useCallback(() => {
    submitAnswerRef.current([]);
    setPhaseRef.current("feedback");
  }, []);

  /* ── timer hook ────────────────────────────────────────────────── */
  const {
    timeLeft,
    feedbackCountdown,
    clearTimer,
    clearFeedbackTimer,
    startFeedbackCountdown,
    timerExpired,
  } = useGameTimer({
    phase,
    roomTimer: room?.timer ?? 30,
    questionId,
    hasAnswered,
    onExpire: onTimerExpire,
  });
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  /* ── effects ────────────────────────────────────────────────────── */
  // Pre-fill nickname from auth
  useEffect(() => {
    if (user?.pseudo && !joined) {
      setNickname(user.pseudo);
    }
  }, [user?.pseudo, joined]);

  // Fetch room on mount
  useEffect(() => {
    api(`/rooms/${roomId}`)
      .then((d) => {
        const r = d as RoomInfo;
        setRoom(r);
        const savedPid = sessionStorage.getItem(`player-${roomId}`);
        const savedNick = sessionStorage.getItem(`nickname-${roomId}`);
        if (savedNick) setNickname(savedNick);
        if (savedPid && r.players.some((p) => p.id === savedPid)) {
          reconnectRef.current = {
            pid: savedPid,
            nickname:
              savedNick || r.players.find((p) => p.id === savedPid)!.nickname,
          };
        } else if (
          creatorPid &&
          creatorNick &&
          !r.players.some((p) => p.id === creatorPid)
        ) {
          setNickname(creatorNick);
          reconnectRef.current = { pid: creatorPid, nickname: creatorNick };
        }
      })
      .catch(() => setError(t("room.not_found")));
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── socket lifecycle ──────────────────────────────────────────── */
  const fetchQuestion = useCallback(async () => {
    try {
      const q = (await api(
        `/rooms/${roomId}/current-question/${playerIdRef.current}`,
      )) as { question_id: number; index: number };
      setQuestionId(q.question_id);
      setQuestionIndex(q.index);
      setSelectedChoices([]);
      setHasAnswered(false);
      setTimerWarning(false);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              players: prev.players.map((p) => ({ ...p, answered: false })),
            }
          : prev,
      );
      const qResp = (await api(`/questions/${q.question_id}?game=true`)) as {
        question: {
          text: string;
          difficulty: string;
          choices: { text: string; isCorrect?: boolean }[];
          mediaUrl?: string | null;
          mediaType?: string | null;
          explanation?: string | null;
          sourceUrl?: string | null;
        };
        correctCount?: number;
      };
      // Deterministic shuffle so all players see the same order
      const dbChoices = qResp.question.choices;
      const dbIndices = dbChoices.map((_, i) => i);
      const seed = hashStr(`${roomId}-${q.question_id}`);
      seededShuffle(dbIndices, seed);
      setChoiceOrder(dbIndices);
      choiceOrderRef.current = dbIndices;
      setQuestionChoices(dbIndices.map((i) => dbChoices[i]));
      setChoiceCorrect(new Array(dbChoices.length).fill(false));
      // correctCount tells us if checkboxes (multi) or radio (single) must be shown
      setQuestionCorrectCount(qResp.correctCount ?? 1);
      setQuestionText(qResp.question.text);
      setQuestionDifficulty(qResp.question.difficulty);
      setQuestionMediaUrl(mediaUrl(qResp.question.mediaUrl) ?? null);
      setQuestionMediaType(qResp.question.mediaType ?? null);
      setQuestionExplanation(qResp.question.explanation ?? null);
      setQuestionSourceUrl(qResp.question.sourceUrl ?? null);
      setPhase("game");
    } catch {
      setPhase("end");
      loadScoreboard();
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadScoreboard = useCallback(async () => {
    try {
      const sb = (await api(
        `/rooms/${roomId}/scoreboard`,
      )) as ScoreboardEntry[];
      setScoreboard(sb);
    } catch {
      /* ignore */
    }
  }, [roomId]);

  // keep refs in sync for socket event handlers
  const fetchQuestionRef = useRef(fetchQuestion);
  fetchQuestionRef.current = fetchQuestion;
  const loadScoreboardRef = useRef(loadScoreboard);
  loadScoreboardRef.current = loadScoreboard;
  const clearFeedbackTimerRef = useRef(clearFeedbackTimer);
  clearFeedbackTimerRef.current = clearFeedbackTimer;
  const clearTimerRef = useRef(clearTimer);
  clearTimerRef.current = clearTimer;
  const startFeedbackCountdownRef = useRef(startFeedbackCountdown);
  startFeedbackCountdownRef.current = startFeedbackCountdown;

  useEffect(() => {
    const socket = getSocket(roomId);
    socketRef.current = socket;
    socket.emit("join-room", roomId);

    socket.on(
      "player-answered",
      (data: { playerId: string; questionId: number }) => {
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === data.playerId ? { ...p, answered: true } : p,
            ),
          };
        });
      },
    );

    socket.on(
      "player-joined",
      (data: { playerId: string; nickname: string }) => {
        setRoom((prev) => {
          if (!prev) return prev;
          if (prev.players.some((p) => p.id === data.playerId)) return prev;
          return {
            ...prev,
            players: [
              ...prev.players,
              {
                id: data.playerId,
                nickname: data.nickname,
                score: 0,
                finished: false,
                disconnected: false,
                answered: false,
              },
            ],
            player_count: prev.player_count + 1,
          };
        });
      },
    );

    socket.on("player-left", (data: { playerId: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== data.playerId),
          player_count: prev.player_count - 1,
        };
      });
    });

    socket.on("game-started", () => {
      setCorrectCount(0);
      setTimerWarning(false);
      fetchQuestionRef.current();
    });

    socket.on("question-feedback", (data: QuestionFeedbackPayload) => {
      if (questionIdRef.current && data.question_id !== questionIdRef.current)
        return;

      // Update choiceCorrect from socket data for correct display
      if (data.correct_choices && choiceOrderRef.current.length > 0) {
        const newChoiceCorrect = choiceOrderRef.current.map((dbIdx) =>
          data.correct_choices.includes(dbIdx),
        );
        setChoiceCorrect(newChoiceCorrect);
      }

      const own = data.results.find((r) => r.player_id === playerIdRef.current);
      const allCorrect = data.results.filter((r) => r.correct);
      const allWrong = data.results.filter((r) => !r.correct);
      if (own) {
        const playerCount = data.results.length;
        setResult({
          correct: own.correct,
          points: own.points,
          bonus: own.bonus,
          streak: own.streak,
          cumulative_time: own.cumulative_time,
        });
        if (own.correct) {
          setCorrectCount((prev) => prev + 1);
        }
        setFeedbackMeta({
          correct: own.correct,
          onlyCorrect: own.correct && allCorrect.length === 1,
          firstCorrect:
            own.correct &&
            allCorrect.length > 0 &&
            allCorrect[0].player_id === playerIdRef.current,
          onlyWrong: !own.correct && allWrong.length === 1 && playerCount >= 3,
          difficulty: questionDifficulty,
          streak: own.streak,
          totalQuestions: roomRef.current?.total_questions,
          earnedPoints: own.points,
          score:
            roomRef.current?.players.find((p) => p.id === playerIdRef.current)
              ?.score ?? 0,
          correctCount: correctCount + (own.correct ? 1 : 0),
          category: "",
          pseudo: nickname,
        });
      }
      setPhase("feedback");
      clearTimerRef.current();
      startFeedbackCountdownRef.current();
    });

    socket.on("next-question", () => {
      clearFeedbackTimerRef.current();
      setResult(null);
      fetchQuestionRef.current();
    });

    socket.on("game-finished", () => {
      clearFeedbackTimerRef.current();
      setPhase("end");
      loadScoreboardRef.current();
    });

    socket.on("player-ready", (data: { playerId: string; ready: boolean }) => {
      setReadyPlayers((prev) => {
        const next = new Set(prev);
        if (data.ready) {
          next.add(data.playerId);
        } else {
          next.delete(data.playerId);
        }
        return next;
      });
    });

    socket.on("room-replayed", () => {
      clearFeedbackTimerRef.current();
      setPhase("ready");
      setResult(null);
      setScoreboard([]);
      setHasAnswered(false);
      setSelectedChoices([]);
      setCorrectCount(0);
      setTimerWarning(false);
      setReadyPlayers(new Set());
      setIsReady(false);
      // Refresh room state from engine
      api(`/rooms/${roomId}`).then((d) => setRoom(d as RoomInfo));
    });

    socket.on("answer-error", (data: { error: string }) => {
      if (phaseRef.current === "feedback") return;
      setError(data.error);
    });

    /* ── reconnection ────────────────────────────────────────────── */
    if (reconnectRef.current) {
      const rc = reconnectRef.current;
      reconnectRef.current = null;
      const tryReconnect = async () => {
        try {
          await api(`/rooms/${roomId}/join`, {
            method: "POST",
            body: JSON.stringify({
              player_id: rc.pid,
              nickname: rc.nickname,
            }),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.toLowerCase().includes("already in room")) {
            return;
          }
        }
        setPlayerId(rc.pid);
        playerIdRef.current = rc.pid;
        setNickname(rc.nickname);
        setJoined(true);
        socket.emit("player-joined", {
          roomId,
          playerId: rc.pid,
          nickname: rc.nickname,
        });
        try {
          const d = (await api(`/rooms/${roomId}`)) as RoomInfo;
          setRoom(d);
        } catch {
          /* best-effort */
        }
        if (room?.status === "playing") fetchQuestionRef.current();
      };
      tryReconnect();
    }

    const handleBeforeUnload = () => {
      const pid = playerIdRef.current;
      if (pid && phaseRef.current !== "game") {
        socket.emit("leave-room", roomId);
        socket.emit("player-left", { roomId, playerId: pid });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      const pid = playerIdRef.current;
      if (pid && phaseRef.current !== "game") emitPlayerLeft(roomId, pid);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      disconnectRoom(roomId);
      clearTimerRef.current();
      clearFeedbackTimerRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /* ── feedback fallback (12s timeout) ────────────────────────────── */
  useEffect(() => {
    if (phase !== "feedback") return;
    const timeout = setTimeout(() => fetchQuestion(), 12000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionId]);

  /* ── helpers ───────────────────────────────────────────────────── */
  const formatError = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    return message || fallback;
  };

  /* ── handlers ──────────────────────────────────────────────────── */
  const handleJoin = useCallback(async () => {
    if (!nickname.trim() || joining || joined) return;
    setJoining(true);
    setError("");
    const pid = playerId || creatorPid || `${nickname}-${Date.now()}`;
    try {
      await api(`/rooms/${roomId}/join`, {
        method: "POST",
        body: JSON.stringify({ player_id: pid, nickname }),
      });
      setPlayerId(pid);
      playerIdRef.current = pid;
      sessionStorage.setItem(`player-${roomId}`, pid);
      sessionStorage.setItem(`nickname-${roomId}`, nickname);
      setJoined(true);
      const d = (await api(`/rooms/${roomId}`)) as RoomInfo;
      setRoom(d);
      socketRef.current?.emit("player-joined", {
        roomId,
        playerId: pid,
        nickname,
      });
    } catch (err) {
      setError(formatError(err, t("room.join_failed")));
    } finally {
      setJoining(false);
    }
  }, [nickname, joining, joined, playerId, creatorPid, roomId, t]);

  const handleStart = useCallback(async () => {
    try {
      await api(`/rooms/${roomId}/start?player_id=${playerIdRef.current}`, {
        method: "POST",
      });
      socketRef.current?.emit("game-started", { roomId });
      await fetchQuestion();
    } catch (err) {
      setError(formatError(err, t("room.start_failed")));
    }
  }, [roomId, fetchQuestion, t]);

  const handleSoloStart = useCallback(async () => {
    if (soloStarting) return;
    if (joined) {
      await handleStart();
      return;
    }
    setSoloStarting(true);
    setError("");
    const defaultNick = t("room.default_nick") || "Player";
    const usedNickname = nickname || defaultNick;
    const pid = playerId || `${usedNickname}-${Date.now()}`;
    try {
      await api(`/rooms/${roomId}/join`, {
        method: "POST",
        body: JSON.stringify({ player_id: pid, nickname: usedNickname }),
      });
      setPlayerId(pid);
      playerIdRef.current = pid;
      sessionStorage.setItem(`player-${roomId}`, pid);
      sessionStorage.setItem(`nickname-${roomId}`, usedNickname);
      setJoined(true);
      socketRef.current?.emit("player-joined", {
        roomId,
        playerId: pid,
        nickname: usedNickname,
      });
      await handleStart();
    } catch (err) {
      setError(formatError(err, t("room.start_failed")));
    } finally {
      setSoloStarting(false);
    }
  }, [soloStarting, joined, handleStart, nickname, playerId, roomId, t]);

  const handlePlayAgain = useCallback(async () => {
    if (isReplaying) return;
    setIsReplaying(true);
    try {
      setError("");
      await api(`/rooms/${roomId}/replay`, { method: "POST" });

      if (room?.mode === "solo") {
        clearFeedbackTimer();
        setResult(null);
        setScoreboard([]);
        await api(`/rooms/${roomId}/start?player_id=${playerIdRef.current}`, {
          method: "POST",
        });
        socketRef.current?.emit("game-started", { roomId });
        await fetchQuestion();
      }
    } catch (err) {
      setError(formatError(err, t("room.replay_failed")));
    } finally {
      setIsReplaying(false);
    }
  }, [isReplaying, room?.mode, roomId, fetchQuestion, clearFeedbackTimer, t]);

  const handleToggleReady = useCallback(() => {
    const newReady = !isReady;
    setIsReady(newReady);
    setReadyPlayers((prev) => {
      const next = new Set(prev);
      if (newReady) {
        next.add(playerIdRef.current);
      } else {
        next.delete(playerIdRef.current);
      }
      return next;
    });
    socketRef.current?.emit("player-ready", {
      roomId,
      playerId: playerIdRef.current,
      ready: newReady,
    });
  }, [isReady, roomId]);

  const handleChoice = useCallback(
    (idx: number) => {
      if (hasAnswered) return;
      setSelectedChoices((prev) => {
        const toggle = (xs: number[]) =>
          xs.includes(idx) ? xs.filter((i) => i !== idx) : [...xs, idx];
        if (questionCorrectCount <= 1) {
          return prev.includes(idx) ? [] : [idx];
        }
        return toggle(prev);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [hasAnswered, questionCorrectCount],
  );

  const handleAnswerSubmit = useCallback(() => {
    submitAnswer(selectedChoices);
    if (timeLeftRef.current <= 5 && timeLeftRef.current > 0) {
      setTimerWarning(true);
    }
    if (room?.mode === "solo") {
      setPhase("feedback");
      clearTimer();
    }
  }, [submitAnswer, selectedChoices, room?.mode, clearTimer]);

  const getChoiceStyle = useCallback(
    (idx: number, selected: number[], correct: boolean[]): string => {
      if (correct[idx])
        return "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-900 dark:text-emerald-100";
      if (selected.includes(idx))
        return "bg-rose-100 dark:bg-rose-900/40 border-rose-500 text-rose-900 dark:text-rose-100";
      return "bg-white dark:bg-gray-800 border-rose-200 dark:border-gray-700 text-gray-500 dark:text-gray-400";
    },
    [],
  );

  /* ── computed values ───────────────────────────────────────────── */
  const answeredCount = room?.players.filter((p) => p.answered).length ?? 0;
  const totalActive = room?.players.filter((p) => !p.disconnected).length ?? 0;
  const isFeedback = phase === "feedback";
  const perfectScore =
    correctCount > 0 &&
    correctCount >= (room?.total_questions ?? 0) &&
    (room?.total_questions ?? 0) > 0;

  /* ── host hook ─────────────────────────────────────────────────── */
  const { hostMessage, hostExpression } = useHostMessages({
    phase,
    roomMode: room?.mode,
    questionIndex,
    questionDifficulty,
    questionMediaType,
    feedbackMeta,
    timerExpired,
    timerWarning,
    scoreboard,
    playerId,
    playerPseudo: nickname,
    perfectScore,
  });

  /* ── return ────────────────────────────────────────────────────── */
  return {
    room,
    phase,
    error,
    nickname,
    setNickname,
    playerId,
    joined,
    questionId,
    questionIndex,
    questionChoices,
    questionText,
    questionDifficulty,
    questionMediaUrl,
    questionMediaType,
    questionExplanation,
    questionSourceUrl,
    questionCorrectCount,
    selectedChoices,
    choiceCorrect,
    timeLeft,
    result,
    scoreboard,
    timerExpired,
    soloStarting,
    joining,
    isReplaying,
    readyPlayers,
    isReady,
    hasAnswered,
    feedbackCountdown,
    feedbackMeta,
    perfectScore,
    timerWarning,
    correctCount,
    hostMessage,
    hostExpression,
    answeredCount,
    totalActive,
    isFeedback,
    creatorPid,
    handleJoin,
    handleStart,
    handleSoloStart,
    handlePlayAgain,
    handleToggleReady,
    handleChoice,
    handleAnswerSubmit,
    getChoiceStyle,
  };
}
