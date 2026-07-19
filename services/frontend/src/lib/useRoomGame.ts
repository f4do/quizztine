import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  christineMessage: string;
  christineExpression: string;
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
  const [timeLeft, setTimeLeft] = useState(0);

  const [result, setResult] = useState<AnswerResult | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [timerExpired, setTimerExpired] = useState(false);
  const [soloStarting, setSoloStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  const [hasAnswered, setHasAnswered] = useState(false);
  const [feedbackCountdown, setFeedbackCountdown] = useState(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── refs ───────────────────────────────────────────────────────── */
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionIdRef = useRef(0);
  const playerIdRef = useRef(playerId);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const choiceOrderRef = useRef<number[]>([]);
  const reconnectRef = useRef<{ pid: string; nickname: string } | null>(null);
  const prevTimeLeft = useRef(0);

  /* ── custom questionId setter (keeps ref in sync) ──────────────── */
  const setQuestionId = (n: number) => {
    questionIdRef.current = n;
    _setQuestionId(n);
  };

  /* ── creator data from sessionStorage ──────────────────────────── */
  const creatorPid = sessionStorage.getItem(`creatorPid-${roomId}`);
  const creatorNick = sessionStorage.getItem(`creatorNick-${roomId}`);

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
  }, [roomId]);

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

  const [feedbackMeta, setFeedbackMeta] = useState<FeedbackMeta>({
    correct: false,
    onlyCorrect: false,
    firstCorrect: false,
    onlyWrong: false,
    difficulty: null,
  });

  /* ── socket lifecycle ──────────────────────────────────────────── */
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
      fetchQuestion();
    });

    socket.on("question-feedback", (data: QuestionFeedbackPayload) => {
      if (questionIdRef.current && data.question_id !== questionIdRef.current)
        return;

      // Update choiceCorrect from socket data for correct display
      // (the REST API no longer exposes isCorrect when ?game=true)
      if (data.correct_choices && choiceOrderRef.current.length > 0) {
        const newChoiceCorrect = choiceOrderRef.current.map((dbIdx) =>
          data.correct_choices.includes(dbIdx),
        );
        setChoiceCorrect(newChoiceCorrect);
      }

      const own = data.results.find(
        (r) => r.player_id === playerIdRef.current,
      );
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
        setFeedbackMeta({
          correct: own.correct,
          onlyCorrect: own.correct && allCorrect.length === 1,
          firstCorrect:
            own.correct &&
            allCorrect.length > 0 &&
            allCorrect[0].player_id === playerIdRef.current,
          onlyWrong: !own.correct && allWrong.length === 1 && playerCount >= 3,
          difficulty: questionDifficulty,
        });
      }
      setPhase("feedback");
      clearTimer();
      startFeedbackCountdown();
    });

    socket.on("next-question", () => {
      clearFeedbackTimer();
      setResult(null);
      fetchQuestion();
    });

    socket.on("game-finished", () => {
      clearFeedbackTimer();
      setPhase("end");
      loadScoreboard();
    });

    socket.on(
      "player-ready",
      (data: { playerId: string; ready: boolean }) => {
        setReadyPlayers((prev) => {
          const next = new Set(prev);
          if (data.ready) {
            next.add(data.playerId);
          } else {
            next.delete(data.playerId);
          }
          return next;
        });
      },
    );

    socket.on("room-replayed", () => {
      clearFeedbackTimer();
      setPhase("ready");
      setResult(null);
      setScoreboard([]);
      setHasAnswered(false);
      setTimerExpired(false);
      setSelectedChoices([]);
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
        if (room?.status === "playing") fetchQuestion();
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
      clearTimer();
      clearFeedbackTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, clearTimer, clearFeedbackTimer, room?.status]);

  /* ── game timer ────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "game") return;
    setTimeLeft(room?.timer ?? 30);
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
  }, [phase, room?.timer, clearTimer]);

  /* ── timer expired detection ───────────────────────────────────── */
  useEffect(() => {
    if (phase !== "game" || questionId === 0 || hasAnswered) return;
    if (prevTimeLeft.current > 0 && timeLeft === 0) {
      setTimerExpired(true);
      setPhase("feedback");
      clearTimer();
      submitAnswer([]);
    }
    prevTimeLeft.current = timeLeft;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase, questionId]);

  /* ── feedback fallback (12s timeout) ────────────────────────────── */
  useEffect(() => {
    if (phase !== "feedback") return;
    const timeout = setTimeout(() => fetchQuestion(), 12000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionId]);

  /* ── helpers ───────────────────────────────────────────────────── */
  const startFeedbackCountdown = () => {
    setFeedbackCountdown(5);
    feedbackTimerRef.current = setInterval(() => {
      setFeedbackCountdown((prev) => {
        if (prev <= 1) {
          clearFeedbackTimer();
          setResult(null);
          setTimeout(() => fetchQuestion(), 200);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchQuestion = async () => {
    try {
      const q = (await api(
        `/rooms/${roomId}/current-question/${playerIdRef.current}`,
      )) as { question_id: number; index: number };
      setQuestionId(q.question_id);
      setQuestionIndex(q.index);
      setSelectedChoices([]);
      setTimerExpired(false);
      setHasAnswered(false);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              players: prev.players.map((p) => ({ ...p, answered: false })),
            }
          : prev,
      );
      const qResp = (await api(
        `/questions/${q.question_id}?game=true`,
      )) as {
        question: {
          text: string;
          difficulty: string;
          choices: { text: string; isCorrect?: boolean }[];
          mediaUrl?: string | null;
          mediaType?: string | null;
          explanation?: string | null;
          sourceUrl?: string | null;
        };
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
      setQuestionText(qResp.question.text);
      setQuestionDifficulty(qResp.question.difficulty);
      setQuestionMediaUrl(mediaUrl(qResp.question.mediaUrl) ?? null);
      setQuestionMediaType(qResp.question.mediaType ?? null);
      setQuestionExplanation(qResp.question.explanation ?? null);
      setQuestionSourceUrl(qResp.question.sourceUrl ?? null);
      setTimeLeft(room?.timer ?? 30);
      setPhase("game");
    } catch {
      setPhase("end");
      loadScoreboard();
    }
  };

  const loadScoreboard = async () => {
    try {
      const sb = (await api(
        `/rooms/${roomId}/scoreboard`,
      )) as ScoreboardEntry[];
      setScoreboard(sb);
    } catch {
      /* ignore */
    }
  };

  const formatError = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    return message || fallback;
  };

  /* ── handlers ──────────────────────────────────────────────────── */
  const handleJoin = async () => {
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
  };

  const handleStart = async () => {
    try {
      await api(
        `/rooms/${roomId}/start?player_id=${playerIdRef.current}`,
        { method: "POST" },
      );
      socketRef.current?.emit("game-started", { roomId });
      await fetchQuestion();
    } catch (err) {
      setError(formatError(err, t("room.start_failed")));
    }
  };

  const handleSoloStart = async () => {
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
  };

  const handlePlayAgain = async () => {
    if (isReplaying) return;
    setIsReplaying(true);
    try {
      setError("");
      await api(`/rooms/${roomId}/replay`, { method: "POST" });

      if (room?.mode === "solo") {
        clearFeedbackTimer();
        setResult(null);
        setScoreboard([]);
        await api(
          `/rooms/${roomId}/start?player_id=${playerIdRef.current}`,
          { method: "POST" },
        );
        socketRef.current?.emit("game-started", { roomId });
        await fetchQuestion();
      }
    } catch (err) {
      setError(formatError(err, t("room.replay_failed")));
    } finally {
      setIsReplaying(false);
    }
  };

  const handleToggleReady = () => {
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
  };

  const submitAnswer = (choices: number[]) => {
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
  };

  const handleChoice = (idx: number) => {
    if (hasAnswered) return;
    setSelectedChoices((prev) => {
      const toggle = (xs: number[]) =>
        xs.includes(idx) ? xs.filter((i) => i !== idx) : [...xs, idx];
      if (choiceCorrect.filter(Boolean).length <= 1) {
        return prev.includes(idx) ? [] : [idx];
      }
      return toggle(prev);
    });
  };

  const handleAnswerSubmit = () => {
    submitAnswer(selectedChoices);
    if (room?.mode === "solo") {
      setPhase("feedback");
      clearTimer();
    }
  };

  const getChoiceStyle = (
    idx: number,
    selected: number[],
    correct: boolean[],
  ): string => {
    if (correct[idx])
      return "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-900 dark:text-emerald-100";
    if (selected.includes(idx))
      return "bg-rose-100 dark:bg-rose-900/40 border-rose-500 text-rose-900 dark:text-rose-100";
    return "bg-white dark:bg-gray-800 border-rose-200 dark:border-gray-700 text-gray-500 dark:text-gray-400";
  };

  /* ── computed values ───────────────────────────────────────────── */
  const answeredCount =
    room?.players.filter((p) => p.answered).length ?? 0;
  const totalActive =
    room?.players.filter((p) => !p.disconnected).length ?? 0;
  const isFeedback = phase === "feedback";

  const christineMessage = useMemo(() => {
    if (phase === "pre-game") {
      return room?.mode === "solo"
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
        (s) => s.player_id === playerIdRef.current,
      );
      if (!own) return t("christine.end.default");
      if (
        room?.mode !== "solo" &&
        scoreboard.length > 0 &&
        scoreboard.every((s) => s.score === 0)
      )
        return t("room.easter_egg");
      if (scoreboard[0]?.player_id === playerIdRef.current)
        return t("christine.end.winner", { score: own.score });
      if (own.score === 0) return t("christine.end.low");
      return t("christine.end.default", { score: own.score });
    }
    return "";
  }, [
    phase,
    room?.mode,
    questionIndex,
    questionDifficulty,
    feedbackMeta,
    timerExpired,
    scoreboard,
    t,
  ]);

  const christineExpression = useMemo(() => {
    if (phase === "end") {
      const own = scoreboard.find(
        (s) => s.player_id === playerIdRef.current,
      );
      if (own && scoreboard[0]?.player_id === playerIdRef.current)
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
  }, [phase, feedbackMeta, timerExpired, scoreboard]);

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
    christineMessage,
    christineExpression,
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
