import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zh } from '../locales/zh';
import { en } from '../locales/en';

type Language = 'zh' | 'en';
type Dictionary = typeof zh;

const dictionaries: Record<Language, Dictionary> = {
  zh,
  en,
};

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => set((state) => ({ language: state.language === 'zh' ? 'en' : 'zh' })),
    }),
    {
      name: 'i18n-storage',
    }
  )
);

// Get value from dictionary by dot-separated path (e.g. "header.notifications")
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj) || path;
};

export const useTranslation = () => {
  const language = useI18nStore((state) => state.language);
  const dict = dictionaries[language];

  const t = (key: string): string => {
    return getNestedValue(dict, key);
  };

  return { t, language };
};
