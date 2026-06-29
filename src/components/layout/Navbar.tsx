'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Menu, Bell, Settings, LogOut, Paintbrush, HardDrive, Plug, Volume2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import ThemeToggle from '@/components/ThemeToggle';
import BDClock from './BDClock';
import { useBrand } from '@/context/BrandContext';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { useTranslation } from '@/context/LanguageContext';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

const getNotificationLink = (n: any) => {
  const type = n.type?.toUpperCase();
  const idParam = n.referenceId ? `?id=${n.referenceId}` : '';
  switch (type) {
    case 'TASK': return `/dashboard/tasks${idParam}`;
    case 'LEAVE': return `/dashboard/leaves${idParam}`;
    case 'USER_MANAGEMENT': return '/dashboard/employees';
    case 'ANNOUNCEMENT': return '/dashboard/announcements';
    case 'PERFORMANCE': return '/dashboard/performance';
    case 'PAYROLL': return '/dashboard/payroll';
    case 'ATTENDANCE': return '/dashboard/attendance';
    default: return '/dashboard';
  }
};

export default function Navbar({ onMobileMenuToggleAction }: { onMobileMenuToggleAction?: () => void }) {
  const { user, logout } = useAuth();
  const { brand } = useBrand();
  const { t, language } = useTranslation();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number>(0);

  const p = brand.primaryColor;
  const s = brand.secondaryColor;
  const gradient = `linear-gradient(135deg, ${p}, ${s})`;

  const hasFetchedRef = useRef(false);
  const prevUnreadCount = useRef(0);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const newUnreadCount = res.data.filter((n: any) => !n.read).length;
      
      if (hasFetchedRef.current) {
        if (newUnreadCount > prevUnreadCount.current) {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(err => console.warn("Autoplay prevented by browser:", err));
        }
      } else {
        hasFetchedRef.current = true;
      }
      
      prevUnreadCount.current = newUnreadCount;
      setNotifications(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Initialize SSE for real-time notifications
      const eventSource = new EventSource('/api/sse/notifications');
      
      eventSource.onmessage = (event) => {
        try {
          const newNotification = JSON.parse(event.data);
          
          // Only process notifications meant for this user (or global ones like announcements)
          if (newNotification.userId && newNotification.userId !== user.id && newNotification.type !== 'Announcement') return;
          
          setNotifications(prev => [newNotification, ...prev]);
          prevUnreadCount.current = prevUnreadCount.current + 1;
          
          // Play sound
          const audio = new Audio('/notification.mp3');
          audio.play().catch(err => console.warn("Autoplay prevented by browser:", err));
          
          // Show toast
          const msg = newNotification.messageEn || newNotification.messageBn || newNotification.message || 'New Notification';
          toast.success(msg);
        } catch (e) {
          console.error("Failed to parse SSE notification:", e);
        }
      };

      return () => eventSource.close();
    }
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await api.patch('/notifications');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (_) { }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
    } catch (_) { }
  };

  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

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
        <div className="flex items-center gap-3">
          <BDClock />
          <div className="hidden md:block">
            <span className="text-gray-400 text-sm font-medium">
              {getGreeting()}, {user?.name || 'Admin'}
            </span>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />

        {/* Notification Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full animate-pulse bg-brand-primary" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-700/50 rounded-2xl shadow-xl dark:shadow-lg dark:shadow-black/20 overflow-hidden z-50 flex flex-col max-h-[32rem]">
              <div className="p-4 border-b border-slate-100 dark:border-white/10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">Notifications</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleMarkAllAsRead} 
                      disabled={unreadCount === 0}
                      className="text-[10px] font-semibold text-brand-primary hover:text-brand-secondary disabled:opacity-50 transition-colors"
                    >
                      Mark all read
                    </button>
                    <span className="text-slate-300 dark:text-gray-600">|</span>
                    <button 
                      onClick={handleClearAll}
                      disabled={notifications.length === 0}
                      className="text-[10px] font-semibold text-slate-500 hover:text-red-500 disabled:opacity-50 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setActiveTab('unread')}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${activeTab === 'unread' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}
                  >
                    Unread
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-brand-primary text-white leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Bell className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-500">{activeTab === 'unread' ? 'No unread notifications' : 'You are all caught up!'}</p>
                  </div>
                ) : (
                  filteredNotifications.map(n => {
                    const dispTitle = language === 'bn' ? (n.titleBn || n.titleEn || n.title) : (n.titleEn || n.titleBn || n.title);
                    const dispMsg = language === 'bn' ? (n.messageBn || n.messageEn || n.message) : (n.messageEn || n.messageBn || n.message);
                    return (
                    <Link
                      href={getNotificationLink(n)}
                      onClick={() => {
                        if (!n.read) {
                          api.patch('/notifications', { id: n.id }).catch(() => {});
                          setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
                        }
                        setShowNotifications(false);
                      }}
                      key={n.id}
                      className={`relative p-3 mb-1 rounded-xl transition-colors duration-150 flex gap-3 block ${!n.read ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-gray-700 dark:hover:text-white'}`}
                    >
                      {!n.read && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-primary" />
                      )}
                      <div className={`flex-1 ${!n.read ? 'pl-2' : 'pl-0'}`}>
                        <p className={`text-[13px] leading-tight ${!n.read ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-gray-300'}`}>
                          {dispTitle}
                        </p>
                        <p className={`text-xs mt-1 leading-snug ${!n.read ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-gray-400'}`}>
                          {dispMsg}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                          {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </Link>
                    );
                  })
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
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-700/50 rounded-2xl shadow-xl dark:shadow-lg dark:shadow-black/20 overflow-hidden z-50">
              {/* User info header */}
              <div className="p-4 border-b border-slate-100 dark:border-white/10">
                <p className="text-slate-800 dark:text-white font-medium text-sm flex items-center gap-2">
                  {user?.name}
                  {user?.employeeId && user.employeeId !== 'UNMAPPED_FALLBACK' && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                      {user.employeeId}
                    </span>
                  )}
                </p>
                <p className="text-slate-500 dark:text-gray-500 text-xs mt-0.5">{user?.email}</p>
                <span
                  className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/20 text-brand-primary"
                >
                  {typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation}
                </span>
              </div>

              <div className="p-2">
                {/* Appearance & Integrations — Admin/Superadmin only */}
                {user && ['Admin', 'Super Admin', 'System Administrator'].includes(typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation) && (
                  <>
                    <Link
                      href="/dashboard/settings/appearance"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 group text-brand-primary hover:bg-slate-100 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      <Paintbrush className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">{t('appearance')}</span>
                    </Link>
                    <Link
                      href="/dashboard/settings/integrations"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 group text-brand-primary hover:bg-slate-100 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      <Plug className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">{language === 'bn' ? 'ইন্টিগ্রেশন' : 'Integrations'}</span>
                    </Link>
                  </>
                )}



                <Link
                  href="/dashboard/profile"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 dark:hover:text-white text-sm transition-colors duration-150"
                >
                  <Settings className="w-4 h-4" /> {t('profileSettings')}
                </Link>

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-500/5 dark:hover:bg-gray-700 text-sm transition-colors duration-150"
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
