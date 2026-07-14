'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Language, TranslationKey } from '@/i18n/translations';
import { useAuth } from './AuthContext';

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
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  // Hydrate from user profile or browser settings after mount
  useEffect(() => {
    if (user?.language && (user.language === 'en' || user.language === 'bn')) {
      setLanguageState(user.language as Language);
    } else {
      // Fallback to browser language if no user preference is set
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'bn') {
        setLanguageState('bn');
      } else {
        setLanguageState('en');
      }
    }
    setMounted(true);
  }, [user]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // The actual persistence is handled by the LanguageSwitcher component
  }, []);

  // Translation lookup
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
    // Render with a default (e.g., 'en') and let the useEffect correct it client-side
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
