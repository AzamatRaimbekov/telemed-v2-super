import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ru from "@/locales/ru.json";
import ky from "@/locales/ky.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      ky: { translation: ky },
    },
    fallbackLng: "ru",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "medcore_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
