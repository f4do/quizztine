import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./locales/fr/translation.json";
import en from "./locales/en/translation.json";

const defaultLang = import.meta.env.VITE_DEFAULT_LANG || "fr";

try {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      fallbackLng: defaultLang,
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
      },
      interpolation: {
        escapeValue: false,
      },
    });
} catch (e) {
  // i18n initialization may fail in test environments where
  // react-i18next is mocked without initReactI18next export
  console.warn("i18n initialization skipped:", e);
}

export default i18n;
