import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeSwitcher from "./ThemeSwitcher";
import HostAvatar from "./host/HostAvatar";
import { useHost } from "../lib/HostProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, logout, loading } = useAuth();
  const { host } = useHost();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen tv-backdrop transition-colors">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-rose-200/50 dark:border-rose-900/50 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <HostAvatar
                expression="smile"
                size="sm"
                avatarType={host.avatarType}
                avatarConfig={host.avatarConfig}
                avatarUrl={host.avatarUrl}
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-2xl tracking-wide text-tv-red dark:text-tv-gold uppercase group-hover:scale-105 transition-transform origin-left">
                {t("nav.quizztine")}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-tv-purple/80 dark:text-tv-gold/60 font-semibold">
                Culture Générale
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <ThemeSwitcher />
            <LanguageSwitcher />
            {loading ? null : user ? (
              <div className="hidden sm:flex items-center gap-3 ml-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 hover:text-tv-red dark:hover:text-tv-gold font-medium transition-colors"
                  title={t("nav.profile")}
                >
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-tv-red to-tv-purple text-white text-xs flex items-center justify-center font-bold">
                    {user.pseudo.slice(0, 1).toUpperCase()}
                  </span>
                  {user.pseudo}
                </Link>
                {(user.role === "QUIZMASTER" || user.role === "QUIZADMIN") && (
                  <Link
                    to="/admin"
                    className="text-tv-red dark:text-tv-gold hover:underline font-medium"
                  >
                    {t("nav.admin")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer text-xs uppercase tracking-wide font-semibold"
                >
                  {t("nav.logout")}
                </button>
              </div>
            ) : (
              <div className="hidden sm:grid grid-cols-2 gap-2 ml-2 items-center min-w-[210px]">
                <Link
                  to="/login"
                  className="inline-block w-full text-center px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-800 text-tv-red dark:text-tv-gold text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/register"
                  className="inline-block w-full text-center px-3 py-1.5 rounded-full bg-tv-red text-white text-xs font-semibold hover:bg-tv-red-dark transition-colors shadow-sm"
                >
                  {t("nav.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main
        className={`mx-auto ${isHome ? "max-w-4xl px-4 sm:px-6 py-12" : "max-w-6xl px-4 sm:px-6 py-8"}`}
      >
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-tv-purple/60 dark:text-tv-gold/40">
        Quizztine — {t("home.subtitle")}
      </footer>
    </div>
  );
}
