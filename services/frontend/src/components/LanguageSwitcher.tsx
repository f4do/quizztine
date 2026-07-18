import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
    if (user) {
      api("/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  return (
    <div className="flex rounded-full border border-rose-200 dark:border-rose-900/50 overflow-hidden bg-white dark:bg-gray-800">
      {["fr", "en"].map((lang) => (
        <button
          key={lang}
          onClick={() => handleChange(lang)}
          className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            i18n.language === lang
              ? "bg-tv-gold text-tv-purple"
              : "text-gray-600 dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-gray-700"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
