import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es.json';
import pt from './locales/pt.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      pt: { translation: pt },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'pt'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'auditor_ia_lang',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
