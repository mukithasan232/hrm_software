import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, KeyRound } from 'lucide-react';

interface PasswordInputWithValidatorProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onValidityChange?: (isValid: boolean) => void;
}

export default function PasswordInputWithValidator({
  value,
  onChange,
  onGenerate,
  disabled = false,
  placeholder = 'Enter password',
  className = '',
  onValidityChange
}: PasswordInputWithValidatorProps) {
  const [show, setShow] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const checks = {
    length: value.length >= 6,
    number: /\d/.test(value),
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(value)
  };

  const isValid = Object.values(checks).every(Boolean);

  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  }, [isValid, onValidityChange]);

  const CheckItem = ({ met, label }: { met: boolean, label: string }) => (
    <div className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${met ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-gray-500'}`}>
      {met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="space-y-2 w-full">
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/25 transition-all font-semibold ${className} ${onGenerate ? 'pr-20' : 'pr-10'}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {onGenerate && (
             <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={onGenerate}
              title="Generate Password"
              className="p-1 text-slate-400 hover:text-brand-primary transition-colors disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setShow(!show)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 transition-all duration-300 ${isFocused || value ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
        <CheckItem met={checks.length} label="At least 6 characters" />
        <CheckItem met={checks.number} label="Includes number" />
        <CheckItem met={checks.lowercase} label="Includes lowercase letter" />
        <CheckItem met={checks.uppercase} label="Includes uppercase letter" />
        <CheckItem met={checks.special} label="Includes special symbol" />
      </div>
    </div>
  );
}
