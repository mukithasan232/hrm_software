'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Language, TranslationKey } from '@/i18n/translations';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'hrm_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored && (stored === 'en' || stored === 'bn')) {
        setLanguageState(stored);
      }
    } catch (_) {}
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }, []);

  // Translation lookup — returns the string for the current language,
  // falls back to English if a key is somehow missing from BN dictionary.
  const t = useCallback(
    (key: TranslationKey): string => {
      return (translations[language] as Record<string, string>)[key]
        ?? (translations.en as Record<string, string>)[key]
        ?? key;
    },
    [language]
  );

  // Prevent flash of wrong language during SSR hydration
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ language: 'en', setLanguage, t: (k) => (translations.en as Record<string, string>)[k] ?? k }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTranslation() {
  return useContext(LanguageContext);
}
