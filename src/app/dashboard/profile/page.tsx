'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Camera, Save, Lock, User, Mail, Building, Printer, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useBrand } from '@/context/BrandContext';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/LanguageContext';
import PasswordInputWithValidator from '@/components/ui/PasswordInputWithValidator';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

// ─── Country Code List ────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { flag: '🇧🇩', code: '+880', country: 'Bangladesh' },
  { flag: '🇺🇸', code: '+1', country: 'USA / Canada' },
  { flag: '🇬🇧', code: '+44', country: 'United Kingdom' },
  { flag: '🇦🇺', code: '+61', country: 'Australia' },
  { flag: '🇮🇳', code: '+91', country: 'India' },
  { flag: '🇵🇰', code: '+92', country: 'Pakistan' },
  { flag: '🇸🇦', code: '+966', country: 'Saudi Arabia' },
  { flag: '🇦🇪', code: '+971', country: 'UAE' },
  { flag: '🇶🇦', code: '+974', country: 'Qatar' },
  { flag: '🇰🇼', code: '+965', country: 'Kuwait' },
  { flag: '🇸🇬', code: '+65', country: 'Singapore' },
  { flag: '🇲🇾', code: '+60', country: 'Malaysia' },
  { flag: '🇯🇵', code: '+81', country: 'Japan' },
  { flag: '🇰🇷', code: '+82', country: 'South Korea' },
  { flag: '🇨🇳', code: '+86', country: 'China' },
  { flag: '🇳🇱', code: '+31', country: 'Netherlands' },
  { flag: '🇩🇪', code: '+49', country: 'Germany' },
  { flag: '🇫🇷', code: '+33', country: 'France' },
  { flag: '🇮🇹', code: '+39', country: 'Italy' },
  { flag: '🇨🇦', code: '+1', country: 'Canada' },
  { flag: '🇧🇷', code: '+55', country: 'Brazil' },
  { flag: '🇷🇺', code: '+7', country: 'Russia' },
  { flag: '🇿🇦', code: '+27', country: 'South Africa' },
  { flag: '🇳🇬', code: '+234', country: 'Nigeria' },
  { flag: '🇪🇬', code: '+20', country: 'Egypt' },
] as const;

/** Splits a stored phone string like '+880 1XXXXXXXXX' → { code: '+880', local: '1XXXXXXXXX' } */
function parsePhone(phone: string) {
  if (!phone) return { code: '+880', local: '' };
  const match = COUNTRY_CODES.find(c => phone.startsWith(c.code));
  if (match) return { code: match.code, local: phone.slice(match.code.length).trim() };
  // fallback: treat entire value as local
  return { code: '+880', local: phone.replace(/^\+\d+\s?/, '').trim() };
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { brand } = useBrand();
  const { t } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);



  const [form, setForm] = useState({
    name: '', designation: '', department: '', phone: '',
    facebook: '', linkedin: '', github: '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [isNewPasswordValid, setIsNewPasswordValid] = useState(false);
  const [imgError, setImgError] = useState(false);

  // ── Phone country-code state ──
  const [countryCode, setCountryCode] = useState('+880');
  const [localPhone, setLocalPhone] = useState('');
  const [phoneDropOpen, setPhoneDropOpen] = useState(false);
  const phoneDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const rawPhone = (user as any).phone || '';
      const { code, local } = parsePhone(rawPhone);
      setCountryCode(code);
      setLocalPhone(local);
      setForm({
        name: user.name || '',
        designation: (user as any).designation?.name || (user as any).designation || '',
        department: (user as any).department?.name || (user as any).department || '',
        phone: rawPhone,
        facebook: (user as any).facebook || '',
        linkedin: (user as any).linkedin || '',
        github: (user as any).github || '',
      });
    }
  }, [user]);

  // Close phone dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (phoneDropRef.current && !phoneDropRef.current.contains(e.target as Node)) {
        setPhoneDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePhoneChange = (newCode: string, newLocal: string) => {
    const merged = newLocal.trim() ? `${newCode} ${newLocal.trim()}` : '';
    setCountryCode(newCode);
    setLocalPhone(newLocal);
    setForm(prev => ({ ...prev, phone: merged }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      // Append all form fields (name, designation, department, phone, social links)
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await api.put('/users/profile/me', formData);

      updateUser({
        name: res.data.user.name,
        profileImage: res.data.user.profileImage,
        designation: res.data.user.designation,
        department: res.data.user.department,
      });

      toast.success(t('saveChanges') + '!');
      setAvatarFile(null);
      setPreview(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error('New passwords do not match!');
    }
    if (passwords.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setChangingPw(true);
    try {
      await api.put('/users/profile/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password changed successfully!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const avatarSrc = preview || (user?.profileImage ? `${BACKEND}${user.profileImage}` : null);
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  useEffect(() => {
    setImgError(false);
  }, [avatarSrc]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="print-hide">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-slate-550 dark:text-gray-400 mt-1 text-sm font-medium">Manage your personal information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="print-hide bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-sm dark:shadow-2xl">
            <div className="relative inline-block">
              {avatarSrc && !imgError ? (
                <img
                  src={avatarSrc}
                  alt="Profile"
                  onError={() => setImgError(true)}
                  className="h-28 w-28 rounded-full object-cover border-4 border-slate-200 dark:border-white/10 shadow-2xl mx-auto"
                />
              ) : (
                <div className="h-28 w-28 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-slate-200 dark:border-white/10 shadow-2xl mx-auto bg-gradient-to-tr from-brand-primary to-brand-secondary">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full border-2 border-white dark:border-slate-900 transition-colors shadow-md text-white bg-brand-primary"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div>
              <p className="text-slate-900 dark:text-white font-bold text-lg">{user?.name}</p>
              <p className="text-slate-550 dark:text-gray-400 text-sm font-semibold">{(user as any)?.designation?.name || (user as any)?.designation}</p>
              <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold border bg-brand-primary/10 text-brand-primary border-brand-primary/30">
                {(user as any)?.designation?.name || (user as any)?.designation}
              </span>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10 space-y-2 text-left">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 font-semibold">
                <Mail className="w-4 h-4 text-slate-400 dark:text-gray-500 flex-shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 font-semibold">
                <Building className="w-4 h-4 text-slate-400 dark:text-gray-500 flex-shrink-0" />
                <span className="truncate">{(user as any)?.department?.name || (user as any)?.department || 'Not set'}</span>
              </div>
            </div>

            {preview && (
              <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg p-2 font-semibold">
                New photo selected. Save profile to apply.
              </p>
            )}
          </div>

          {/* Virtual ID Card */}
          <div className="print-hide bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Virtual ID Card</h2>
              <button onClick={() => window.print()} className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg font-semibold transition-colors flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            <div className="print-only-id-card relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-2xl p-6 text-center text-white isolate">
              {/* Glassmorphism background effects */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/30 blur-2xl -z-10" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-purple-500/30 blur-2xl -z-10" />

              <div className="mb-4 font-black text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase">
                {brand?.companyName?.replace('Portal', '').trim() || 'HRM SYSTEM'}
              </div>

              <div className="mb-4">
                {avatarSrc && !imgError ? (
                  <img src={avatarSrc} alt="Profile" onError={() => setImgError(true)} className="h-24 w-24 rounded-full object-cover border-4 border-white/20 mx-auto shadow-lg" />
                ) : (
                  <div className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white/20 shadow-lg mx-auto bg-gradient-to-tr from-indigo-500 to-purple-500">
                    {initials}
                  </div>
                )}
              </div>

              <h3 className="font-bold text-xl mb-1">{user?.name}</h3>
              <p className="text-blue-300 font-semibold text-xs mb-5">{(user as any)?.designation?.name || (user as any)?.designation || 'Employee'}</p>

              <div className="bg-white rounded-xl p-2.5 shadow-inner inline-block mb-3">
                <QRCodeSVG value={(user as any)?.employeeId || 'EMP-UNKNOWN'} size={70} />
              </div>

              <div className="text-xs font-mono text-slate-300 tracking-widest bg-black/20 py-1.5 rounded-lg border border-white/10">
                {(user as any)?.employeeId || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Forms */}
        <div className="print-hide lg:col-span-2 space-y-6">
          {/* Personal Info Form */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-blue-550 dark:text-blue-400" /> {t('personalInfo')}
            </h2>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">{t('fullName')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">{t('phone')}</label>

                  {/* ── Country Code + Phone Input ── */}
                  <div className="flex rounded-xl overflow-visible border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all">

                    {/* Country Code Dropdown */}
                    <div className="relative flex-shrink-0" ref={phoneDropRef}>
                      <button
                        type="button"
                        id="phone-code-btn"
                        onClick={() => setPhoneDropOpen(prev => !prev)}
                        className="flex items-center gap-1.5 h-full px-3 py-2.5 border-r border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors rounded-l-xl min-w-[80px] touch-target"
                        aria-haspopup="listbox"
                        aria-expanded={phoneDropOpen}
                      >
                        <span className="text-base leading-none">
                          {COUNTRY_CODES.find(c => c.code === countryCode)?.flag ?? '🌐'}
                        </span>
                        <span className="tabular-nums">{countryCode}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${phoneDropOpen ? 'rotate-180' : ''
                            }`}
                        />
                      </button>

                      {/* Dropdown list */}
                      {phoneDropOpen && (
                        <ul
                          role="listbox"
                          className="absolute left-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl w-56 max-h-64 overflow-y-auto py-1 scrollbar-thin"
                        >
                          {COUNTRY_CODES.map(({ flag, code, country }) => (
                            <li
                              key={`${code}-${country}`}
                              role="option"
                              aria-selected={countryCode === code && COUNTRY_CODES.find(c => c.code === countryCode)?.country === country}
                              onClick={() => {
                                handlePhoneChange(code, localPhone);
                                setPhoneDropOpen(false);
                              }}
                              className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors ${countryCode === code
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                                  : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                            >
                              <span className="text-base flex-shrink-0">{flag}</span>
                              <span className="flex-1 truncate">{country}</span>
                              <span className="tabular-nums text-slate-400 dark:text-gray-500 font-semibold text-xs flex-shrink-0">{code}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Local number input */}
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={localPhone}
                      onChange={e => handlePhoneChange(countryCode, e.target.value)}
                      placeholder="1700 000000"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none font-semibold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">{t('designation')}</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={e => setForm({ ...form, designation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">{t('department')}</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-primary/40 cursor-pointer hover:opacity-90 bg-brand-primary"
                >
                  <Save className="w-4 h-4" />
                  {saving ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>

          {/* ── Social Media Profiles Card ── */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {/* Minimal link-chain icon inline SVG */}
                <svg className="w-5 h-5 text-pink-500 dark:text-pink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {t('socialMedia')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 ml-7">{t('socialMediaSub')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Facebook */}
              <div className="space-y-1">
                <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.428c0-3.007 1.792-4.669 4.532-4.669 1.313 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" /></svg>
                  {t('facebookLabel')}
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all overflow-hidden">
                  <span className="px-3 py-2.5 border-r border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-500 text-xs font-mono select-none whitespace-nowrap">fb.com/</span>
                  <input
                    type="url"
                    value={form.facebook}
                    onChange={e => setForm({ ...form, facebook: e.target.value })}
                    placeholder="https://facebook.com/username"
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* LinkedIn */}
              <div className="space-y-1">
                <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-sky-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                  {t('linkedinLabel')}
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all overflow-hidden">
                  <span className="px-3 py-2.5 border-r border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-500 text-xs font-mono select-none whitespace-nowrap">in/</span>
                  <input
                    type="url"
                    value={form.linkedin}
                    onChange={e => setForm({ ...form, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* GitHub */}
              <div className="space-y-1">
                <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                  {t('githubLabel')}
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all overflow-hidden">
                  <span className="px-3 py-2.5 border-r border-slate-200 dark:border-white/10 text-slate-400 dark:text-gray-500 text-xs font-mono select-none whitespace-nowrap">github.com/</span>
                  <input
                    type="url"
                    value={form.github}
                    onChange={e => setForm({ ...form, github: e.target.value })}
                    placeholder="https://github.com/username"
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

            </div>

            {/* Save button mirrors Personal Info save */}
            <div className="pt-4">
              <button
                onClick={handleProfileSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-primary/40 cursor-pointer hover:opacity-90 bg-brand-primary"
              >
                <Save className="w-4 h-4" />
                {saving ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </div>

          {/* Password Form */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Lock className="w-5 h-5 text-purple-550 dark:text-purple-400" /> {t('changePassword')}
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwords.currentPassword}
                  onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 transition-all font-semibold"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">New Password</label>
                  <PasswordInputWithValidator
                    value={passwords.newPassword}
                    onChange={val => setPasswords({ ...passwords, newPassword: val })}
                    onValidityChange={setIsNewPasswordValid}
                    placeholder="Enter new password"
                    className="focus:ring-purple-500/25"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passwords.confirmPassword}
                    onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 transition-all font-semibold"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={changingPw || !isNewPasswordValid}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-brand-secondary/40 hover:opacity-90 bg-brand-secondary"
                >
                  <Lock className="w-4 h-4" />
                  {changingPw ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
