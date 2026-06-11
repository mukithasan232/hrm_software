import React from 'react';
import { Check, X, Key } from 'lucide-react';

interface PasswordValidatorProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  placeholder?: string;
}

export default function PasswordValidator({
  value,
  onChange,
  onGenerate,
  placeholder = 'Enter secure password',
}: PasswordValidatorProps) {
  const criteria = [
    { label: 'At least 6 characters', test: (v: string) => v.length >= 6 },
    { label: 'Includes number', test: (v: string) => /\d/.test(v) },
    { label: 'Includes lowercase letter', test: (v: string) => /[a-z]/.test(v) },
    { label: 'Includes uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
    { label: 'Includes special symbol', test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          required
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
          placeholder={placeholder}
        />
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            className="px-3 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
          >
            <Key className="w-3.5 h-3.5" /> Generate
          </button>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-3 space-y-1.5">
        {criteria.map((c, i) => {
          const passed = c.test(value);
          return (
            <div key={i} className="flex items-center gap-2 text-xs font-medium">
              {passed ? (
                <div className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                  <Check className="w-3 h-3" />
                </div>
              ) : (
                <div className="p-0.5 rounded-full bg-red-500/10 text-red-500">
                  <X className="w-3 h-3" />
                </div>
              )}
              <span className={passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-gray-400'}>
                {c.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
