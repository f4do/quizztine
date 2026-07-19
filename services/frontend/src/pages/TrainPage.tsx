import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import Layout from "../components/Layout";
import { AppHostPresenter } from "../components/host";
import Card from "../components/ui/Card";

export default function TrainPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/categories")
      .then((d) => setCategories((d as { categories: string[] }).categories))
      .catch(() => {});
  }, []);

  const handleTrain = async () => {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { mode: "solo", questionCount: 10 };
      if (selected) body.categories = [selected];
      if (difficulty) body.difficulty = difficulty;
      const data = (await api("/rooms", {
        method: "POST",
        body: JSON.stringify(body),
      })) as { room: { id: string } };
      navigate(`/room/${data.room.id}`);
    } catch {
      setError(t("train.start_error"));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-16 text-center">
          <Card className="rounded-3xl p-8 animate-pop-in">
            <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-4">
              {t("train.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("train.login_prompt")}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="buzzer-btn px-8 py-3 rounded-2xl bg-tv-red text-white font-bold uppercase tracking-wider hover:bg-tv-red-dark cursor-pointer shadow-lg"
            >
              {t("train.login_btn")}
            </button>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
            {t("train.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t("train.description")}
          </p>
        </div>

        <Card className="rounded-3xl p-6 sm:p-8 animate-pop-in">
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              {t("train.pick_theme")}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelected(null)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${!selected ? "bg-tv-purple text-white border-tv-purple" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-tv-purple"}`}
              >
                {t("train.all")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelected(cat)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${selected === cat ? "bg-tv-purple text-white border-tv-purple" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-tv-purple"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              {t("train.pick_difficulty")}
            </label>
            <div className="flex gap-2 flex-wrap">
              {["", "EASY", "MEDIUM", "HARD"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                    difficulty === d
                      ? "bg-tv-gold text-tv-purple border-tv-gold"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-tv-gold"
                  }`}
                >
                  {d || t("train.any")}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4 font-medium">
              {error}
            </p>
          )}

          <button
            onClick={handleTrain}
            disabled={loading}
            className="buzzer-btn w-full px-8 py-4 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-lg uppercase tracking-wider hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {loading ? t("common.loading") : t("train.start")}
          </button>

          {categories.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-4 text-center">
              {t("train.no_categories")}
            </p>
          )}
        </Card>
      </div>

      <AppHostPresenter
        message={t("host.train.prompt")}
        expression="focused"
        position="bottom-right"
        avatarSize="md"
        typing={true}
      />
    </Layout>
  );
}
