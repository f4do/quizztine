import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import Layout from "../components/Layout";
import { ChristinePresenter } from "../components/christine";

export default function HomePage() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Auto-fill code from URL ?code= parameter
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setJoinError("");
    try {
      const data = (await api(`/rooms/code/${code.trim().toUpperCase()}`)) as {
        id: string;
      };
      navigate(`/room/${data.id}`);
    } catch {
      setJoinError(t("home.code_invalid"));
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-10 animate-fade-in-up">
          <div className="inline-block px-4 py-1 rounded-full bg-tv-red/10 dark:bg-tv-gold/10 text-tv-red dark:text-tv-gold text-xs font-bold uppercase tracking-wider mb-4 border border-tv-red/20 dark:border-tv-gold/20">
            {t("home.subtitle")}
          </div>
          <h1 className="font-display text-6xl sm:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-tv-red via-tv-spotlight to-tv-purple dark:from-tv-gold dark:via-tv-spotlight dark:to-tv-red tracking-wide mb-3">
            {t("home.title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
            {t("home.subtitle")}
          </p>
        </div>

        <div
          className="tv-card rounded-3xl p-6 sm:p-8 space-y-6 animate-pop-in"
          style={{ animationDelay: "0.1s" }}
        >
          <button
            onClick={() => navigate("/room/create")}
            className="buzzer-btn w-full px-6 py-5 rounded-2xl bg-gradient-to-r from-tv-red to-tv-red-dark text-white font-bold text-xl uppercase tracking-wider shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all"
          >
            {t("home.create_room")}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-rose-200 dark:border-rose-900/50" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-900 px-4 text-tv-purple/60 dark:text-tv-gold/60 font-semibold uppercase tracking-wider text-xs">
                {t("home.or_join")}
              </span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setJoinError("");
              }}
              placeholder={t("home.room_code")}
              maxLength={6}
              className="w-full rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 bg-white/80 dark:bg-gray-800/80 px-4 py-4 text-center text-3xl font-display tracking-[0.3em] uppercase text-tv-red dark:text-tv-gold focus:border-tv-gold focus:outline-none shadow-inner dark:text-gray-100"
            />
            {joinError && (
              <p className="text-sm text-red-600 dark:text-red-400 font-medium animate-fade-in-up">
                {joinError}
              </p>
            )}
            <button
              type="submit"
              disabled={!code.trim()}
              className="w-full px-6 py-4 rounded-2xl bg-tv-gold text-tv-purple font-bold text-lg uppercase tracking-wider hover:bg-tv-gold-dark transition-colors disabled:opacity-50 shadow-lg cursor-pointer"
            >
              {t("home.join")}
            </button>
          </form>
        </div>
      </div>

      <ChristinePresenter
        message={t("christine.home.welcome")}
        expression="smile"
        position="bottom-right"
        avatarSize="lg"
        typing={true}
      />
    </Layout>
  );
}
