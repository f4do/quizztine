import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Layout from "../components/Layout";
import { AppHostPresenter } from "../components/host";
import Card from "../components/ui/Card";
import { usePhrases } from "../lib/PhrasesProvider";

type Mode = "solo" | "multi_private" | "multi_public";

const COUNT_OPTIONS = [10, 20, 50];

type GameMode = "classic" | "speed" | "elimination";
const GAME_MODES: {
  value: GameMode;
  key: string;
  descKey: string;
  available: boolean;
}[] = [
  {
    value: "classic",
    key: "classic",
    descKey: "classic_desc",
    available: true,
  },
  { value: "speed", key: "speed", descKey: "speed_desc", available: false },
  {
    value: "elimination",
    key: "elimination",
    descKey: "elimination_desc",
    available: false,
  },
];

export default function RoomCreatePage() {
  const { t } = useTranslation();
  const { getPhrase } = usePhrases();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("solo");
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [questionCount, setQuestionCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [timer, setTimer] = useState(30);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isQuizmaster =
    user?.role === "QUIZMASTER" || user?.role === "QUIZADMIN";

  const toggleDifficulty = (d: string) => {
    setDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const MODES: {
    value: Mode;
    label: string;
    icon: string;
    disabled?: boolean;
  }[] = [
    { value: "solo", label: t("room_create.solo"), icon: "🎓" },
    {
      value: "multi_private",
      label: t("room_create.multi_private"),
      icon: "🔒",
    },
    {
      value: "multi_public",
      label: t("room_create.multi_public_soon"),
      icon: "🌐",
      disabled: true,
    },
  ];

  useEffect(() => {
    api("/questions?visibility=PUBLIC")
      .then((d) => {
        const cats = [
          ...new Set<string>(
            (d.questions ?? []).map((q: { category: string }) => q.category),
          ),
        ];
        setAvailableCategories(cats.sort());
      })
      .catch(() => {});
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        mode,
        questionCount: COUNT_OPTIONS.includes(questionCount)
          ? questionCount
          : Math.max(1, parseInt(customCount) || 10),
        timer,
      };
      if (selectedCategories.length > 0) body.categories = selectedCategories;
      if (difficulties.length > 0) body.difficulties = difficulties;
      if (isQuizmaster && includePrivate) body.includePrivate = true;

      const d = (await api("/rooms", {
        method: "POST",
        body: JSON.stringify(body),
      })) as { room: { id: string; code: string; creatorPlayerId?: string } };
      sessionStorage.setItem(`code-${d.room.id}`, d.room.code);
      if (d.room.creatorPlayerId) {
        sessionStorage.setItem(
          `creatorPid-${d.room.id}`,
          d.room.creatorPlayerId,
        );
        if (user?.pseudo)
          sessionStorage.setItem(`creatorNick-${d.room.id}`, user.pseudo);
      }
      navigate(`/room/${d.room.id}`, {
        state: { code: d.room.code, creatorPlayerId: d.room.creatorPlayerId },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
            {t("room_create.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("room_create.subtitle")}
          </p>
        </div>

        <Card className="rounded-3xl p-6 sm:p-8 animate-pop-in">
          {error && (
            <div className="mb-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm animate-fade-in-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {t("room_create.mode")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={m.disabled}
                    onClick={() => !m.disabled && setMode(m.value)}
                    title={
                      m.disabled ? t("room_create.coming_soon") : undefined
                    }
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      mode === m.value && !m.disabled
                        ? "bg-tv-red text-white border-tv-red shadow-md"
                        : m.disabled
                          ? "bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-800 cursor-pointer"
                    }`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <span className="text-xs">{m.label}</span>
                  </button>
                ))}
              </div>
              {mode !== "solo" && !user && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                  {t("room_create.auth_required")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {t("room_create.game_mode")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {GAME_MODES.map((gm) => (
                  <button
                    key={gm.value}
                    type="button"
                    disabled={!gm.available}
                    title={
                      gm.available
                        ? t(`room_create.${gm.descKey}`)
                        : `${t(`room_create.${gm.descKey}`)} — ${t("room_create.coming_soon")}`
                    }
                    onClick={() => gm.available && setGameMode(gm.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      gm.available && gameMode === gm.value
                        ? "bg-tv-red text-white border-tv-red shadow-md"
                        : gm.available
                          ? "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-800 cursor-pointer"
                          : "bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60"
                    }`}
                  >
                    {t(`room_create.${gm.key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {t("room_create.question_count")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COUNT_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setQuestionCount(c);
                      setCustomCount("");
                    }}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                      questionCount === c && !customCount
                        ? "bg-tv-gold text-tv-purple border-tv-gold"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-tv-gold"
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder={t("room_create.custom")}
                  value={customCount}
                  onChange={(e) => {
                    setCustomCount(e.target.value);
                    if (e.target.value) setQuestionCount(0);
                  }}
                  className="w-28 rounded-xl border-2 border-rose-200 dark:border-rose-900/50 px-3 py-2 text-sm focus:border-tv-gold focus:outline-none dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {availableCategories.length > 0 && (
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  {t("room_create.categories")}{" "}
                  {selectedCategories.length > 0 && (
                    <span className="text-tv-red dark:text-tv-gold">
                      ({selectedCategories.length} {t("room_create.n_selected")}
                      )
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all cursor-pointer ${
                        selectedCategories.includes(cat)
                          ? "bg-tv-purple text-white border-tv-purple"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-tv-purple"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {t("room_create.difficulty")}
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDifficulties([])}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                    difficulties.length === 0
                      ? "bg-tv-purple text-white border-tv-purple"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-tv-purple"
                  }`}
                >
                  {t("room_create.any")}
                </button>
                {["EASY", "MEDIUM", "HARD"].map((d) => {
                  const sel = difficulties.includes(d);
                  const color =
                    d === "EASY"
                      ? sel
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:border-emerald-500"
                      : d === "MEDIUM"
                        ? sel
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:border-amber-500"
                        : sel
                          ? "bg-tv-red text-white border-tv-red"
                          : "bg-white dark:bg-gray-800 text-tv-red dark:text-red-400 border-rose-200 dark:border-rose-800 hover:border-tv-red";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDifficulty(d)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${color}`}
                    >
                      {t(`room_create.${d.toLowerCase()}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {t("room_create.timer")}{" "}
                <span className="text-tv-red dark:text-tv-gold">{timer}s</span>
              </label>
              <input
                type="range"
                min={5}
                max={300}
                step={5}
                value={timer}
                onChange={(e) => setTimer(Number(e.target.value))}
                className="w-full accent-tv-red"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>5s</span>
                <span>300s</span>
              </div>
            </div>

            {isQuizmaster && (
              <label className="flex items-center gap-3 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer p-3 rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                <input
                  type="checkbox"
                  checked={includePrivate}
                  onChange={(e) => setIncludePrivate(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-tv-red focus:ring-tv-red"
                />
                <span>{t("room_create.include_private")}</span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading || (mode !== "solo" && !user)}
              className="buzzer-btn w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-lg uppercase tracking-wider hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg"
            >
              {loading ? t("room_create.creating") : t("room_create.submit")}
            </button>
          </form>
        </Card>
      </div>

      <AppHostPresenter
        message={getPhrase("room_create.welcome")}
        expression="focused"
        position="bottom-right"
        avatarSize="md"
        typing={true}
      />
    </Layout>
  );
}
