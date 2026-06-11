'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Menu, Bell, Settings, LogOut, Paintbrush, HardDrive } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import ThemeToggle from '@/components/ThemeToggle';
import BDClock from './BDClock';
import { useBrand } from '@/context/BrandContext';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { useTranslation } from '@/context/LanguageContext';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

export default function Navbar({ onMobileMenuToggleAction }: { onMobileMenuToggleAction?: () => void }) {
  const { user, logout } = useAuth();
  const { brand } = useBrand();
  const { t, language } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const p = brand.primaryColor;
  const s = brand.secondaryColor;
  const gradient = `linear-gradient(135deg, ${p}, ${s})`;

  useEffect(() => {
    if (user) {
      api.get('/notifications').then(res => setNotifications(res.data)).catch(console.error);
    }
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await api.post('/notifications/read');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (_) {}
  };

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials  = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <header className="h-16 border-b border-slate-200 dark:border-white/10 bg-white/70 dark:bg-black/30 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-50 sticky top-0 transition-colors duration-300">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggleAction}
          className="md:hidden p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-slate-800 dark:text-white font-semibold text-sm hidden sm:block">
            {t('welcome')},{' '}
            <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary">
              {user?.name || 'User'}
            </span>
          </span>
          <BDClock />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) handleMarkAsRead(); }}
            className="relative p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full animate-pulse bg-brand-primary"
              />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden z-50">
              <div className="p-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{t('notifications')}</h3>
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-primary/20 text-brand-primary">
                    {unreadCount} {t('newBadge')}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400 dark:text-gray-500 text-center">{t('allCaughtUp')}</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 border-b border-slate-100 dark:border-white/5 text-xs ${!n.read ? 'text-slate-800 dark:text-white bg-brand-primary/10' : 'text-slate-500 dark:text-gray-400'}`}
                    >
                      <p className="font-bold text-[13px] mb-1">
                        {language === 'bn' ? (n.titleBn || n.titleEn || 'বিজ্ঞপ্তি') : (n.titleEn || n.titleBn || 'Notification')}
                      </p>
                      <p className={!n.read ? 'font-medium' : ''}>
                        {language === 'bn' ? (n.messageBn || n.messageEn || n.message) : (n.messageEn || n.messageBn || n.message)}
                      </p>
                      <p className="text-slate-400 dark:text-gray-500 mt-1.5 text-[10px]">
                        {new Date(n.createdAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar / Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`flex items-center gap-2 p-1 rounded-full transition-all ${showProfile ? 'ring-2 ring-brand-primary/60' : ''}`}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="h-8 w-8 rounded-full object-cover border-2 border-slate-200 dark:border-white/20" />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white/20 bg-gradient-to-tr from-brand-primary to-brand-secondary"
              >
                {initials}
              </div>
            )}
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden z-50">
              {/* User info header */}
              <div className="p-4 border-b border-slate-100 dark:border-white/10">
                <p className="text-slate-800 dark:text-white font-medium text-sm">{user?.name}</p>
                <p className="text-slate-500 dark:text-gray-500 text-xs">{user?.email}</p>
                <span
                  className="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/20 text-brand-primary"
                >
                  {typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation}
                </span>
              </div>

              <div className="p-2">
                {/* Appearance — Admin/Superadmin only */}
                {user && ['Admin', 'Super Admin', 'System Administrator'].includes(typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation) && (
                  <Link
                    href="/dashboard/settings/appearance"
                    onClick={() => setShowProfile(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group text-brand-primary hover:bg-brand-primary/10"
                  >
                    <Paintbrush className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{t('appearance')}</span>
                  </Link>
                )}

                <Link
                  href="/dashboard/profile"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 text-sm transition-colors"
                >
                  <Settings className="w-4 h-4" /> {t('profileSettings')}
                </Link>

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-500/5 dark:hover:bg-red-500/10 text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" /> {t('signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
