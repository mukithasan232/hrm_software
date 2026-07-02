'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDetailsStore } from '@/store/useDetailsStore';
import { useAuth } from '@/context/AuthContext';
import { Menu, Bell, Settings, LogOut, Paintbrush, HardDrive, Plug, Volume2, Clock } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import toast from 'react-hot-toast';
import ThemeToggle from '@/components/ThemeToggle';
import BDClock from './BDClock';
import { useBrand } from '@/context/BrandContext';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import NotificationModal from '@/components/notifications/NotificationModal';
import { useTranslation } from '@/context/LanguageContext';
import { useBreakTimer, BreakDepartment } from '@/hooks/useBreakTimer';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

const getNotificationLink = (n: any) => {
  const type = n.type?.toUpperCase();
  const title = (n.titleEn || n.titleBn || n.title || '').toLowerCase();
  
  if (type === 'ATTENDANCE' || title.includes('late')) {
    return '/dashboard/attendance';
  }

  const idParam = n.referenceId ? `?id=${n.referenceId}` : '';
  switch (type) {
    case 'TASK': return `/dashboard/tasks${idParam}`;
    case 'LEAVE': return `/dashboard/leaves${idParam}`;
    case 'USER_MANAGEMENT': return '/dashboard/employees';
    case 'ANNOUNCEMENT': return '/dashboard/announcements';
    case 'PERFORMANCE': return '/dashboard/performance';
    case 'PAYROLL': return '/dashboard/payroll';
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
  const [userDept, setUserDept] = useState<BreakDepartment | null>(null);
  
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { isBreakActive, activeBreak, timeRemaining } = useBreakTimer(userDept);
  
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

  const playNotificationSound = (type?: string) => {
    let filename = 'notification.mp3';
    switch (type?.toUpperCase()) {
      case 'ATTENDANCE':
        filename = 'chime.mp3';
        break;
      case 'TASK':
        filename = 'ding.mp3'; // or bell.mp3
        break;
      case 'LEAVE':
        filename = 'swoosh.mp3';
        break;
      case 'ANNOUNCEMENT':
        filename = 'bell.mp3';
        break;
      default:
        filename = 'notification.mp3';
        break;
    }

    const audio = new Audio(`/sounds/${filename}`); 
    audio.play().catch((error) => {
      console.warn('Browser autoplay policy blocked the notification sound:', error);
    });
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const newUnreadCount = res.data.filter((n: any) => !n.read).length;
      
      if (hasFetchedRef.current) {
        if (newUnreadCount > prevUnreadCount.current) {
          const firstUnread = res.data.find((n: any) => !n.read);
          playNotificationSound(firstUnread?.type);
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
      
      if (user.department || (user as any).departmentId) {
        api.get('/team/departments').then(res => {
          const dept = res.data.find((d: any) => d.id === (user as any).departmentId || d.name === user.department);
          if (dept) setUserDept(dept);
        }).catch(err => console.error(err));
      }
      
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
          playNotificationSound(newNotification.type);
          
          // Show toast
          const title = newNotification.titleEn || newNotification.titleBn || newNotification.title || 'New Notification';
          const msg = newNotification.messageEn || newNotification.messageBn || newNotification.message || '';
          
          toast.custom((t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-sm w-full bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-100 dark:border-slate-700 pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <span className="text-xl">🔔</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {msg}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus:outline-none"
                >
                  Close
                </button>
              </div>
            </div>
          ), {
            position: 'bottom-right',
            duration: 8000,
          });
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

  const handleNotificationClick = (notif: any) => {
    setSelectedNotification(notif);
    
    if (notif.type === 'USER_VERIFICATION' && notif.referenceId) {
      useDetailsStore.getState().openDetails('employee', notif.referenceId);
      setShowNotifications(false);
      if (!notif.read) {
        api.patch('/notifications', { id: notif.id }).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      }
      return;
    }

    setIsModalOpen(true);
    
    if (!notif.read) {
      api.patch('/notifications', { id: notif.id }).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    setShowNotifications(false);
  };

  return (
    <>
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
          <div className="hidden md:flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">
              {getGreeting()}, {user?.name || 'Admin'}
            </span>
            {isBreakActive && (
              <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 animate-pulse ml-2">
                <Clock className="w-4 h-4"/>
                {activeBreak === 'LUNCH' ? 'Lunch Time:' : 'Snacks Time:'} {timeRemaining}
              </span>
            )}
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
                    <div
                      onClick={() => handleNotificationClick(n)}
                      key={n.id}
                      className={`relative p-3 mb-1 rounded-xl transition-colors duration-150 flex gap-3 block cursor-pointer ${!n.read ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-gray-700 dark:hover:text-white'}`}
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
                    </div>
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

      <NotificationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        notification={selectedNotification}
      />
    </>
  );
}
