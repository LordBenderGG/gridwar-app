import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import es from './es.json';
import en from './en.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'es';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: deviceLang === 'en' ? 'en' : 'es',
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
