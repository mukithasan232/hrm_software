'use client';
import { useRef, useEffect, useState } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Languages } from 'lucide-react';
import api from '@/services/api';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    { code: 'en' as const, label: 'English', short: 'EN',  flag: '🇬🇧' },
    { code: 'bn' as const, label: 'বাংলা',   short: 'বাংলা', flag: '🇧🇩' },
  ];

  const active = options.find(o => o.code === language) ?? options[0];

  const handleLanguageChange = async (code: 'en' | 'bn') => {
    setLanguage(code);
    setOpen(false);
    try {
      await api.patch('/user/preferences', { language: code });
    } catch (error) {
      console.error('Failed to save language preference', error);
      // Optionally, add a toast notification here to inform the user of the failure.
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger Button */}
      <button
        id="language-switcher-btn"
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch language"
        className={`
          flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-semibold
          transition-all duration-150 select-none
          text-slate-600 dark:text-gray-300
          hover:bg-slate-100 dark:hover:bg-white/10
          hover:text-slate-900 dark:hover:text-white
          ${open ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : ''}
        `}
      >
        <Languages className="w-4 h-4 flex-shrink-0" />
        <span className="tabular-nums text-xs font-bold tracking-wide hidden sm:inline">
          {active.short}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          aria-label="Language options"
          className="
            absolute right-0 top-full mt-2 z-[200]
            bg-white dark:bg-slate-900
            border border-slate-200 dark:border-white/10
            rounded-xl shadow-2xl overflow-hidden
            w-40 py-1
            animate-in fade-in slide-in-from-top-2 duration-150
          "
        >
          {options.map(({ code, label, flag }) => (
            <li
              key={code}
              role="option"
              aria-selected={language === code}
              onClick={() => handleLanguageChange(code)}
              className={`
                flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors
                ${language === code
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 font-medium'
                }
              `}
            >
              <span className="text-base flex-shrink-0">{flag}</span>
              <span className="flex-1">{label}</span>
              {language === code && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
