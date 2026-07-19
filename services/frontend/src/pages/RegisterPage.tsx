import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import Layout from "../components/Layout";
import { AppHostPresenter } from "../components/host";
import Card from "../components/ui/Card";
import { usePhrases } from "../lib/PhrasesProvider";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { getPhrase } = usePhrases();
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 12) {
      setError(t("register.password_error"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("register.password_mismatch"));
      return;
    }
    try {
      await register(pseudo, email, password, confirmPassword);
      navigate("/login");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <Card className="rounded-3xl p-6 sm:p-8 animate-pop-in">
          <div className="text-center mb-6">
            <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide mb-2">
              {t("register.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("register.subtitle")}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 text-sm animate-fade-in-up">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("register.pseudo")}
              </label>
              <input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                required
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("register.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("register.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("register.confirm_password")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              className="buzzer-btn w-full px-4 py-3 rounded-xl bg-tv-red text-white text-sm font-bold uppercase tracking-wider hover:bg-tv-red-dark transition-colors cursor-pointer shadow-lg"
            >
              {t("register.submit")}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            {t("register.has_account")}
            <Link
              to="/login"
              className="text-tv-red dark:text-tv-gold hover:underline font-bold"
            >
              {t("register.login")}
            </Link>
          </p>
        </Card>
      </div>

      <AppHostPresenter
        message={getPhrase("register.welcome")}
        expression="smile"
        position="bottom-right"
        avatarSize="md"
        typing={true}
      />
    </Layout>
  );
}
