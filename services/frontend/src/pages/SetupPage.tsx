import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import Layout from "../components/Layout";
import { AppHostPresenter } from "../components/host";
import Card from "../components/ui/Card";

export default function SetupPage() {
  const { t } = useTranslation();
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!pseudo.trim() || !email.trim() || !password.trim()) {
      setError(t("setup.fill_all_fields"));
      return;
    }
    if (password.length < 12) {
      setError(t("setup.password_error"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("setup.password_mismatch"));
      return;
    }

    setLoading(true);
    try {
      await api("/auth/setup", {
        method: "POST",
        body: JSON.stringify({ pseudo, email, password, confirmPassword, language }),
      });
      navigate("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <Card className="rounded-3xl p-6 sm:p-8 animate-pop-in">
          <div className="text-center mb-6">
            <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
              {t("setup.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("setup.subtitle")}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm animate-fade-in-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="setup-pseudo" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("setup.pseudo")}
              </label>
              <input
                id="setup-pseudo"
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                required
                minLength={2}
                maxLength={30}
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="setup-email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("setup.email")}
              </label>
              <input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="setup-password" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("setup.password")}
              </label>
              <input
                id="setup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="setup-confirm-password" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("setup.confirm_password")}
              </label>
              <input
                id="setup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                {t("setup.language")}
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLanguage("fr")}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    language === "fr"
                      ? "bg-tv-gold text-black shadow-lg"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    language === "en"
                      ? "bg-tv-gold text-black shadow-lg"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  English
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t("setup.language_hint")}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="buzzer-btn w-full px-4 py-3 rounded-xl bg-tv-red text-white text-sm font-bold uppercase tracking-wider hover:bg-tv-red-dark transition-colors cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("setup.creating") : t("setup.submit")}
            </button>
          </form>
        </Card>
      </div>

      <AppHostPresenter
        message="Bienvenue ! Créons votre univers Quizztine. Choisissez votre langue et configurez votre compte administrateur."
        expression="smile"
        position="bottom-right"
        avatarSize="md"
        typing={true}
      />
    </Layout>
  );
}
