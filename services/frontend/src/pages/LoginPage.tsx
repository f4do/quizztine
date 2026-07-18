import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import Layout from "../components/Layout";
import { ChristinePresenter } from "../components/christine";
import Card from "../components/ui/Card";

export default function LoginPage() {
  const { t } = useTranslation();
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(loginInput, password);
      navigate("/");
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
              {t("login.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("christine.login.prompt")}
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
                {t("login.email_or_pseudo")}
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                required
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("login.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-tv-gold focus:outline-none dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              className="buzzer-btn w-full px-4 py-3 rounded-xl bg-tv-red text-white text-sm font-bold uppercase tracking-wider hover:bg-tv-red-dark transition-colors cursor-pointer shadow-lg"
            >
              {t("login.submit")}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            {t("login.no_account")}
            <Link
              to="/register"
              className="text-tv-red dark:text-tv-gold hover:underline font-bold"
            >
              {t("login.register")}
            </Link>
          </p>
        </Card>
      </div>

      <ChristinePresenter
        message={t("christine.login.welcome")}
        expression="focused"
        position="bottom-right"
        avatarSize="md"
        typing={true}
      />
    </Layout>
  );
}
