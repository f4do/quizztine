import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Socket } from "socket.io-client";
import { api, mediaUrl } from "../lib/api";
import { getSocket, disconnectRoom, emitPlayerLeft } from "../lib/socket";
import { useAuth } from "../lib/auth";
import Layout from "../components/Layout";
import { ChristinePresenter } from "../components/christine";
import CircularTimer from "../components/CircularTimer";
import FeedbackBanner from "../components/FeedbackBanner";
import Card from "../components/ui/Card";

interface RoomInfo {
  id: string;
  code?: string;
  mode: string;
  timer: number;
  status: string;
  player_count: number;
  players: {
    id: string;
    nickname: string;
    score: number;
    finished: boolean;
    disconnected: boolean;
    answered?: boolean;
  }[];
}

interface AnswerResult {
  correct: boolean;
  points: number;
  bonus: number;
  streak: number;
  cumulative_time: number;
}

interface QuestionFeedbackPayload {
  question_id: number;
  correct_choices: number[];
  results: {
    player_id: string;
    nickname: string;
    correct: boolean;
    points: number;
    bonus: number;
    streak: number;
    cumulative_time: number;
  }[];
}

interface ScoreboardEntry {
  player_id: string;
  nickname: string;
  score: number;
  streak: number;
  cumulative_time: number;
}

type Phase = "pre-game" | "game" | "feedback" | "end";

export default function RoomPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const roomId = id!;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("pre-game");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
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
  const [timeLeft, setTimeLeft] = useState(0);

  const [result, setResult] = useState<AnswerResult | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [timerExpired, setTimerExpired] = useState(false);
  const [soloStarting, setSoloStarting] = useState(false);
  const [joining, setJoining] = useState(false);

  const [hasAnswered, setHasAnswered] = useState(false);
  const [feedbackCountdown, setFeedbackCountdown] = useState(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionIdRef = useRef(0);
  const playerIdRef = useRef("");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const setQuestionId = (n: number) => {
    questionIdRef.current = n;
    _setQuestionId(n);
  };

  useEffect(() => {
    if (user?.pseudo && !joined) {
      setNickname(user.pseudo);
    }
  }, [user?.pseudo, joined]);

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

  const reconnectRef = useRef<{ pid: string; nickname: string } | null>(null);

  const creatorPid = sessionStorage.getItem(`creatorPid-${roomId}`);
  const creatorNick = sessionStorage.getItem(`creatorNick-${roomId}`);

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
      const own = data.results.find((r) => r.player_id === playerIdRef.current);
      const allCorrect = data.results.filter((r) => r.correct);
      const allWrong = data.results.filter((r) => !r.correct);
      if (own) {
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
          onlyWrong: !own.correct && allWrong.length === 1,
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

    socket.on("answer-error", (data: { error: string }) => {
      // Ignore si déjà en feedback — le round a déjà été scoré côté moteur
      // (race condition timer frontend vs deadline_task moteur)
      if (phaseRef.current === "feedback") return;
      setError(data.error);
    });

    if (reconnectRef.current) {
      const rc = reconnectRef.current;
      reconnectRef.current = null;
      const tryReconnect = async () => {
        try {
          await api(`/rooms/${roomId}/join`, {
            method: "POST",
            body: JSON.stringify({ player_id: rc.pid, nickname: rc.nickname }),
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
  }, [roomId, clearTimer, clearFeedbackTimer, room?.status]);

  useEffect(() => {
    if (phase !== "game" || hasAnswered) return;
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
  }, [phase, room?.timer, clearTimer, hasAnswered]);

  const prevTimeLeft = useRef(0);
  useEffect(() => {
    if (phase !== "game" || questionId === 0 || hasAnswered) return;
    if (prevTimeLeft.current > 0 && timeLeft === 0) {
      setTimerExpired(true);
      // Feedback immédiat de l'UI (choices passent en vert/rouge).
      // Le score et le countdown sont appliqués par question-feedback (socket).
      setPhase("feedback");
      clearTimer();
      // Envoi au serveur pour que le moteur enregistre le timeout
      submitAnswer([]);
    }
    prevTimeLeft.current = timeLeft;
  }, [timeLeft, phase, questionId, hasAnswered]);

  // Fallback: si la phase feedback dure plus de 12s sans question suivante,
  // forcer le fetch (au cas où next-question n'arriverait pas)
  useEffect(() => {
    if (phase !== "feedback") return;
    const timeout = setTimeout(() => fetchQuestion(), 12000);
    return () => clearTimeout(timeout);
  }, [phase, questionId]);

  const [feedbackMeta, setFeedbackMeta] = useState({
    correct: false,
    onlyCorrect: false,
    firstCorrect: false,
    onlyWrong: false,
    difficulty: null as string | null,
  });

  const startFeedbackCountdown = () => {
    setFeedbackCountdown(5);
    feedbackTimerRef.current = setInterval(() => {
      setFeedbackCountdown((prev) => {
        if (prev <= 1) {
          clearFeedbackTimer();
          setResult(null);
          fetchQuestion();
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
      const qResp = (await api(`/questions/${q.question_id}`)) as {
        question: {
          text: string;
          difficulty: string;
          choices: { text: string; isCorrect: boolean }[];
          mediaUrl?: string | null;
          mediaType?: string | null;
          explanation?: string | null;
          sourceUrl?: string | null;
        };
      };
      setQuestionText(qResp.question.text);
      setQuestionDifficulty(qResp.question.difficulty);
      setQuestionChoices(qResp.question.choices);
      setChoiceCorrect(qResp.question.choices.map((c) => c.isCorrect));
      setQuestionMediaUrl(mediaUrl(qResp.question.mediaUrl) ?? null);
      setQuestionMediaType(qResp.question.mediaType ?? null);
      setQuestionExplanation(qResp.question.explanation ?? null);
      setQuestionSourceUrl(qResp.question.sourceUrl ?? null);
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

  const submitAnswer = (choices: number[]) => {
    if (!socketRef.current || hasAnswered) return;
    setHasAnswered(true);
    clearTimer();
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
    socketRef.current.emit("answer", {
      roomId,
      playerId: playerIdRef.current,
      questionId: questionIdRef.current,
      selectedChoices: choices,
      clientTimestamp: Date.now(),
    });
  };

  const handleChoice = (idx: number) => {
    if (hasAnswered) return;
    setSelectedChoices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const handleAnswerSubmit = () => {
    submitAnswer(selectedChoices);
    // Solo : feedback immédiat de l'UI (choices passent en vert/rouge)
    // Le score et le countdown sont appliqués par question-feedback (socket).
    // Si l'event n'arrive pas, un fallback de sécurité force l'avancement.
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

  const answeredCount = room?.players.filter((p) => p.answered).length ?? 0;
  const totalActive = room?.players.filter((p) => !p.disconnected).length ?? 0;
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
      if (feedbackMeta.onlyWrong) return t("christine.feedback.only_wrong");
      return t("christine.feedback.wrong");
    }
    if (phase === "end") {
      const own = scoreboard.find((s) => s.player_id === playerIdRef.current);
      if (!own) return t("christine.end.default");
      if (scoreboard.length > 0 && scoreboard.every((s) => s.score === 0))
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
      const own = scoreboard.find((s) => s.player_id === playerIdRef.current);
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

  if (error) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 text-center">
          <Card className="rounded-3xl p-8 animate-pop-in">
            <p className="text-red-600 dark:text-red-400 mb-6 font-medium">
              {error}
            </p>
            <button
              onClick={() => navigate("/")}
              className="text-tv-red dark:text-tv-gold hover:underline font-bold"
            >
              {t("room.back_home")}
            </button>
          </Card>
        </div>
        <ChristinePresenter
          message={t("christine.error.message")}
          expression="console"
          variant="error"
          position="bottom-right"
          avatarSize="md"
          typing={true}
        />
      </Layout>
    );
  }

  if (!room) {
    return (
      <Layout>
        <div className="text-center text-gray-500 dark:text-gray-400 mt-16 animate-fade-in-up">
          {t("room.loading")}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {phase === "pre-game" && (
          <div className="text-center space-y-6 mt-4 animate-fade-in-up">
            <div className="inline-block">
              <h1 className="font-display text-5xl sm:text-6xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
                {room.mode === "solo" ? t("room.solo_title") : t("room.title")}
              </h1>
              <div className="h-1 w-full bg-gradient-to-r from-tv-gold via-tv-red to-tv-purple rounded-full" />
            </div>

            {room.mode !== "solo" && (
              <div className="inline-block bg-gray-900 dark:bg-gray-800 text-tv-gold font-display text-4xl sm:text-5xl tracking-[0.5em] px-8 py-4 rounded-2xl shadow-2xl border-2 border-tv-gold animate-pulse-glow">
                {room?.code ||
                  (location.state as { code?: string } | null)?.code ||
                  sessionStorage.getItem(`code-${roomId}`) ||
                  roomId.slice(0, 6).toUpperCase()}
              </div>
            )}

            <div className="flex justify-center gap-6 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span className="px-3 py-1 rounded-full bg-white/60 dark:bg-gray-800/60 border border-rose-200 dark:border-rose-900/50">
                {t("room.mode")}{" "}
                <span className="text-tv-red dark:text-tv-gold">
                  {room.mode}
                </span>
              </span>
              <span className="px-3 py-1 rounded-full bg-white/60 dark:bg-gray-800/60 border border-rose-200 dark:border-rose-900/50">
                {t("room.timer")}{" "}
                <span className="text-tv-red dark:text-tv-gold">
                  {room.timer}s
                </span>
              </span>
            </div>

            {room.mode !== "solo" && creatorPid && (
              <Card className="rounded-2xl p-4 text-sm max-w-md mx-auto">
                <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
                  {t("room.share")}
                </p>
                <code className="block bg-rose-50 dark:bg-gray-900 px-4 py-2 rounded-xl border border-rose-200 dark:border-gray-700 text-tv-red dark:text-tv-gold break-all text-xs font-mono">
                  {window.location.href}
                </code>
              </Card>
            )}

            {room.mode !== "solo" && (
              <div>
                <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
                  {t("room.players")}{" "}
                  <span className="text-tv-red dark:text-tv-gold">
                    {room.player_count}
                  </span>
                </p>
                {room.players.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {room.players.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white dark:bg-gray-900 rounded-full border border-rose-200 dark:border-gray-700 text-sm font-medium shadow-sm"
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${p.disconnected ? "bg-gray-400" : "bg-emerald-500 animate-pulse"}`}
                        />
                        {p.nickname}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {room.mode === "solo" ? (
              <Card className="rounded-2xl p-6 max-w-sm mx-auto space-y-4">
                <button
                  onClick={handleSoloStart}
                  disabled={soloStarting}
                  className="buzzer-btn w-full px-8 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-lg uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg"
                >
                  {soloStarting ? t("common.loading") : t("room.solo_start")}
                </button>
              </Card>
            ) : !joined ? (
              <Card className="rounded-2xl p-6 max-w-sm mx-auto space-y-4">
                {!user && (
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={t("room.nickname")}
                    maxLength={50}
                    className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 px-4 py-3 text-sm text-center dark:bg-gray-800 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
                  />
                )}
                <button
                  onClick={handleJoin}
                  disabled={!nickname.trim() || joining}
                  className="buzzer-btn w-full px-6 py-3 rounded-2xl bg-tv-gold text-tv-purple font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg"
                >
                  {joining ? t("common.loading") : t("room.join_btn")}
                </button>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full text-emerald-700 dark:text-emerald-300 text-sm font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t("room.joined_as")} <strong>{nickname}</strong>
                </div>
                {playerId === creatorPid ? (
                  <div>
                    <button
                      onClick={handleStart}
                      className="buzzer-btn px-10 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-purple text-white font-bold text-lg uppercase tracking-wider shadow-lg hover:shadow-xl transition-all cursor-pointer"
                    >
                      {t("room.start")}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {t("room.waiting_for_host")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {(phase === "game" || isFeedback) && (
          <div key={questionId} className="space-y-6 mt-2 animate-question-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-tv-purple text-white text-xs font-bold uppercase tracking-wider">
                  {t("room.question")} {questionIndex + 1}
                </span>
                {room.mode !== "solo" && !isFeedback && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {hasAnswered
                      ? t("room.waiting_for_answers")
                      : t("room.players_answered", {
                          count: answeredCount,
                          total: totalActive,
                        })}
                  </span>
                )}
              </div>
              {!isFeedback ? (
                <CircularTimer
                  timeLeft={timeLeft}
                  total={room?.timer ?? 30}
                  warningThreshold={10}
                  dangerThreshold={5}
                  stopped={hasAnswered}
                />
              ) : (
                <span className="px-3 py-1 rounded-full bg-tv-gold text-tv-purple text-xs font-bold uppercase tracking-wider animate-countdown-pulse">
                  {feedbackCountdown > 0
                    ? t("room.next_question_in", { seconds: feedbackCountdown })
                    : t("room.auto_next")}
                </span>
              )}
            </div>

            <Card className="rounded-3xl p-6 sm:p-8 tv-stage-light min-h-[420px]">
              {isFeedback && result && (
                <FeedbackBanner
                  correct={result.correct}
                  points={result.points}
                  bonus={result.bonus}
                  streak={result.streak}
                  countdown={feedbackCountdown}
                  onlyCorrect={feedbackMeta.onlyCorrect}
                  firstCorrect={feedbackMeta.firstCorrect}
                  onlyWrong={feedbackMeta.onlyWrong}
                  className="-mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5"
                />
              )}
              <div
                className={`transition-opacity duration-300 ${isFeedback ? "opacity-95" : "opacity-100"}`}
              >
                <p className="text-xl sm:text-2xl text-center text-gray-900 dark:text-gray-100 font-bold mb-6 leading-relaxed">
                  {questionText || t("room.loading_question")}
                </p>

                {questionMediaUrl && questionMediaType === "image" && (
                  <img
                    src={questionMediaUrl}
                    alt="question media"
                    className="max-h-64 rounded-2xl mx-auto mb-6 object-contain shadow-lg"
                  />
                )}
                {questionMediaUrl && questionMediaType === "audio" && (
                  <audio
                    controls
                    preload="auto"
                    className="w-full mb-6 rounded-xl"
                    src={questionMediaUrl}
                  />
                )}
                {questionMediaUrl && questionMediaType === "video" && (
                  <video
                    controls
                    preload="auto"
                    className="max-h-64 rounded-2xl mx-auto mb-6 w-full shadow-lg"
                    src={questionMediaUrl}
                  />
                )}

                {questionId > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {questionChoices.map((choice, idx) => {
                      const isSelected = selectedChoices.includes(idx);
                      const isCorrect = choiceCorrect[idx];
                      const inFeedback = isFeedback;
                      const containerClasses = inFeedback
                        ? getChoiceStyle(idx, selectedChoices, choiceCorrect)
                        : isSelected
                          ? "bg-tv-gold/20 border-tv-gold text-tv-purple dark:text-tv-gold shadow-md"
                          : "bg-white dark:bg-gray-800 border-rose-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-tv-gold hover:shadow-sm";
                      const iconClasses = inFeedback
                        ? isCorrect
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : isSelected
                            ? "bg-rose-500 text-white border-rose-500"
                            : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                        : isSelected
                          ? "bg-tv-gold text-tv-purple border-tv-gold"
                          : "border-rose-200 dark:border-gray-600 text-gray-400 dark:text-gray-500";
                      const iconContent = inFeedback
                        ? isCorrect
                          ? "✓"
                          : isSelected
                            ? "✗"
                            : String.fromCharCode(65 + idx)
                        : isSelected
                          ? "✓"
                          : String.fromCharCode(65 + idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            !inFeedback && !hasAnswered && handleChoice(idx)
                          }
                          disabled={hasAnswered || inFeedback}
                          className={`buzzer-btn answer-choice text-left px-4 py-4 rounded-xl border-2 text-sm font-bold transition-all ${containerClasses} ${hasAnswered || inFeedback ? "opacity-90 cursor-not-allowed" : "cursor-pointer hover:scale-[1.01] active:scale-[0.99]"}`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold mr-3 transition-colors duration-300 ${iconClasses}`}
                          >
                            {iconContent}
                          </span>
                          {choice.text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {!isFeedback && !(hasAnswered && room?.mode === "solo") && (
              <button
                onClick={handleAnswerSubmit}
                disabled={selectedChoices.length === 0 || hasAnswered}
                className="buzzer-btn w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-lg uppercase tracking-wider hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {hasAnswered
                  ? t("room.waiting_for_answers")
                  : t("room.submit_answer")}
              </button>
            )}

            {isFeedback && questionExplanation && (
              <div className="bg-tv-cream dark:bg-gray-900 rounded-2xl p-5 text-left text-sm text-gray-700 dark:text-gray-300 border-2 border-amber-200 dark:border-gray-700 shadow-sm animate-fade-in-up">
                <p className="font-display text-lg text-tv-purple dark:text-tv-gold mb-2 uppercase tracking-wide">
                  {t("room.explanation")}
                </p>
                <p className="leading-relaxed">{questionExplanation}</p>
                {questionSourceUrl && (
                  <a
                    href={questionSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-tv-red dark:text-tv-gold hover:underline font-bold"
                  >
                    {t("room.source")} →
                  </a>
                )}
              </div>
            )}

          </div>
        )}

        {phase === "end" && (
          <div className="space-y-6 mt-4 text-center animate-fade-in-up">
            <div className="inline-block">
              <h2 className="font-display text-5xl sm:text-6xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2 animate-bounce-in">
                {t("room.game_over")}
              </h2>
              <div className="h-1 w-full bg-gradient-to-r from-tv-gold via-tv-red to-tv-purple rounded-full" />
            </div>

            <div className="tv-card rounded-3xl border-2 border-tv-gold/50 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-tv-gold/20 to-tv-red/20 dark:from-tv-gold/10 dark:to-tv-red/10 p-4 border-b border-tv-gold/30">
                <div className="flex justify-center gap-12 text-sm font-bold uppercase tracking-wider text-tv-purple dark:text-tv-gold">
                  <span>{t("room.player_col")}</span>
                  <span>{t("room.score")}</span>
                  <span>{t("room.time")}</span>
                </div>
              </div>
              <div className="divide-y divide-rose-100 dark:divide-gray-800">
                {scoreboard.map((s, i) => (
                  <div
                    key={s.player_id}
                    className={`flex items-center justify-between px-6 py-4 animate-fade-in-up ${i === 0 ? "bg-gradient-to-r from-tv-gold/20 to-transparent" : ""}`}
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    <div className="flex items-center gap-3 w-1/3">
                      <span
                        className="animate-bounce-in inline-block text-2xl"
                        style={{ animationDelay: `${i * 0.12 + 0.2}s` }}
                      >
                        {i === 0
                          ? "🥇"
                          : i === 1
                            ? "🥈"
                            : i === 2
                              ? "🥉"
                              : `#${i + 1}`}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {s.nickname}
                      </span>
                    </div>
                    <span className="w-1/3 text-center font-display text-2xl text-tv-red dark:text-tv-gold">
                      {s.score}
                    </span>
                    <span className="w-1/3 text-right text-gray-500 dark:text-gray-400 font-medium">
                      {s.cumulative_time.toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {room &&
              room.mode !== "solo" &&
              scoreboard.length > 0 &&
              scoreboard.every((s) => s.score === 0) && (
                <div className="animate-fade-in-up rounded-2xl p-6 bg-tv-purple/10 dark:bg-tv-purple/20 border-2 border-tv-purple/30 dark:border-tv-purple/50 text-tv-purple dark:text-tv-gold">
                  <p className="text-3xl mb-2">🤝</p>
                  <p className="font-display text-xl uppercase tracking-wide">
                    {t("room.easter_egg")}
                  </p>
                </div>
              )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate(`/room/create`)}
                className="buzzer-btn px-8 py-3 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold uppercase tracking-wider hover:shadow-lg cursor-pointer"
              >
                {t("room.play_again")}
              </button>
              <button
                onClick={() => navigate("/")}
                className="buzzer-btn px-8 py-3 rounded-2xl bg-tv-gold text-tv-purple font-bold uppercase tracking-wider hover:bg-tv-gold-dark cursor-pointer"
              >
                {t("room.home")}
              </button>
            </div>
          </div>
        )}
      </div>

      <ChristinePresenter
        message={christineMessage}
        expression={christineExpression}
        variant={
          phase === "feedback"
            ? result?.correct
              ? "success"
              : "error"
            : phase === "end" &&
                scoreboard[0]?.player_id === playerIdRef.current
              ? "success"
              : "default"
        }
        position="bottom-right"
        avatarSize="lg"
        typing={true}
        key={`${phase}-${questionIndex}-${scoreboard.map((s) => s.score).join(",")}`}
      />
    </Layout>
  );
}
