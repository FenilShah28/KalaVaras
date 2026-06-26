import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import mr from './mr.json';
import en from './en.json';

/**
 * i18next configuration — Marathi (mr) is the DEFAULT language.
 *
 * Language detection order:
 * 1. Browser navigator.language
 * 2. localStorage (for user preference persistence)
 * 3. Falls back to Marathi ('mr')
 *
 * Every UI string MUST exist in both mr.json and en.json.
 * No hardcoded strings in components — hard constraint.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      mr: { translation: mr },
      en: { translation: en },
    },
    fallbackLng: 'mr', // Marathi is the default — not a translation layer
    supportedLngs: ['mr', 'en'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['navigator', 'localStorage', 'htmlTag'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
