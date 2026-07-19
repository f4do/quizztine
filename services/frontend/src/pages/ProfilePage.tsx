import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Layout from "../components/Layout";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { AppHostPresenter } from "../components/host";
import Card from "../components/ui/Card";

interface ProfileData {
  id: string;
  pseudo: string;
  email: string;
  role: string;
  language: string;
  theme: string;
  emailVerified: boolean;
  createdAt: string;
}

interface StatData {
  stat: { gamesPlayed: number; totalScore: number };
  themeStats: Array<{
    category: string;
    totalAnswered: number;
    correctCount: number;
    successRate: number;
  }>;
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [profileRes, statsRes] = await Promise.all([
          api("/users/me") as Promise<{ user: ProfileData }>,
          api("/users/me/stats") as Promise<StatData>,
        ]);
        setProfile(profileRes.user);
        setPseudo(profileRes.user.pseudo);
        setEmail(profileRes.user.email);
        setStats(statsRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    setError("");
    try {
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ pseudo, email }),
      });
      await refreshUser();
      setProfileSuccess(t("profile.edit.success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess("");
    setError("");
    try {
      await api("/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          confirmPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(t("profile.password.success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/users/me", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      await logout();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-500 dark:text-gray-400 py-20">
          {t("common.loading")}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="font-display text-4xl text-tv-red dark:text-tv-gold uppercase tracking-wide">
          {t("profile.title")}
        </h1>

        {error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm font-medium animate-fade-in-up">
            {error}
          </div>
        )}

        <Card className="rounded-3xl p-6">
          <h2 className="font-display text-2xl text-tv-purple dark:text-tv-gold mb-4 uppercase tracking-wide">
            {t("profile.info.title")}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">
                {t("profile.info.pseudo")}
              </dt>
              <dd className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                {user?.pseudo}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">
                {t("profile.info.email")}
              </dt>
              <dd className="font-bold text-gray-900 dark:text-gray-100">
                {user?.email}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">
                {t("profile.info.role")}
              </dt>
              <dd className="font-bold text-gray-900 dark:text-gray-100">
                {user?.role}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs tracking-wider">
                {t("profile.info.member_since")}
              </dt>
              <dd className="font-bold text-gray-900 dark:text-gray-100">
                {profile
                  ? new Date(profile.createdAt).toLocaleDateString(
                      i18n.language,
                    )
                  : "-"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 text-sm">
            {profile?.emailVerified ? (
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                {t("profile.info.verified")}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
                {t("profile.info.not_verified")}
              </span>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl p-6">
          <h2 className="font-display text-2xl text-tv-purple dark:text-tv-gold mb-4 uppercase tracking-wide">
            {t("profile.preferences.title")}
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase text-xs tracking-wider">
                {t("profile.preferences.language")}
              </span>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase text-xs tracking-wider">
                {t("profile.preferences.theme")}
              </span>
              <ThemeSwitcher />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl p-6">
          <h2 className="font-display text-2xl text-tv-purple dark:text-tv-gold mb-4 uppercase tracking-wide">
            {t("profile.edit.title")}
          </h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("profile.edit.pseudo")}
              </label>
              <input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("profile.edit.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
              />
            </div>
            {profileSuccess && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {profileSuccess}
              </p>
            )}
            <button
              type="submit"
              className="buzzer-btn px-6 py-2.5 rounded-xl bg-tv-red text-white font-bold uppercase tracking-wider hover:bg-tv-red-dark transition-colors cursor-pointer shadow-md"
            >
              {t("profile.edit.submit")}
            </button>
          </form>
        </Card>

        <Card className="rounded-3xl p-6">
          <h2 className="font-display text-2xl text-tv-purple dark:text-tv-gold mb-4 uppercase tracking-wide">
            {t("profile.password.title")}
          </h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("profile.password.current")}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("profile.password.new")}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t("profile.password.confirm")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:border-tv-gold focus:outline-none"
              />
            </div>
            {passwordSuccess && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {passwordSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword}
              className="buzzer-btn px-6 py-2.5 rounded-xl bg-tv-red text-white font-bold uppercase tracking-wider hover:bg-tv-red-dark transition-colors disabled:opacity-50 cursor-pointer shadow-md"
            >
              {t("profile.password.submit")}
            </button>
          </form>
        </Card>

        <Card className="rounded-3xl p-6">
          <h2 className="font-display text-2xl text-tv-purple dark:text-tv-gold mb-4 uppercase tracking-wide">
            {t("profile.stats.title")}
          </h2>
          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-tv-gold/20 to-tv-red/10 dark:from-tv-gold/10 dark:to-tv-red/10 p-4 border border-tv-gold/30">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                    {t("profile.stats.games_played")}
                  </div>
                  <div className="text-3xl font-display text-tv-red dark:text-tv-gold">
                    {stats.stat.gamesPlayed}
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-tv-purple/20 to-tv-red/10 dark:from-tv-purple/10 dark:to-tv-red/10 p-4 border border-tv-purple/30">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                    {t("profile.stats.total_score")}
                  </div>
                  <div className="text-3xl font-display text-tv-purple dark:text-tv-gold">
                    {stats.stat.totalScore}
                  </div>
                </div>
              </div>
              {stats.themeStats.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-rose-200 dark:border-gray-700">
                      <th className="py-2 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider">
                        {t("profile.stats.category")}
                      </th>
                      <th className="py-2 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider">
                        {t("profile.stats.answered")}
                      </th>
                      <th className="py-2 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider">
                        {t("profile.stats.correct")}
                      </th>
                      <th className="py-2 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider">
                        {t("profile.stats.success_rate")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.themeStats.map((theme) => (
                      <tr
                        key={theme.category}
                        className="border-b border-rose-100 dark:border-gray-800"
                      >
                        <td className="py-2 text-gray-900 dark:text-gray-100 font-medium">
                          {theme.category}
                        </td>
                        <td className="py-2 text-gray-900 dark:text-gray-100">
                          {theme.totalAnswered}
                        </td>
                        <td className="py-2 text-emerald-600 dark:text-emerald-400 font-bold">
                          {theme.correctCount}
                        </td>
                        <td className="py-2 text-tv-red dark:text-tv-gold font-bold">
                          {theme.successRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {t("profile.stats.no_data")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t("common.loading")}
            </p>
          )}
        </Card>

        <Card className="rounded-3xl p-6 border-2 border-red-200 dark:border-red-900/50">
          <h2 className="font-display text-2xl text-red-700 dark:text-red-400 mb-2 uppercase tracking-wide">
            {t("profile.delete.title")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t("profile.delete.warning")}
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-6 py-2.5 rounded-xl border-2 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer font-bold uppercase text-xs tracking-wider"
            >
              {t("profile.delete.button")}
            </button>
          ) : (
            <form onSubmit={handleDelete} className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400 font-bold">
                {t("profile.delete.confirm")}
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t("profile.delete.password")}
                className="w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!deletePassword}
                  className="buzzer-btn px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {t("profile.delete.button")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                  className="px-6 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer font-bold uppercase text-xs tracking-wider"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <AppHostPresenter
        message={t("host.profile.prompt", { pseudo: user?.pseudo || "" })}
        expression="smile"
        position="bottom-right"
        avatarSize="md"
        typing={true}
      />
    </Layout>
  );
}
