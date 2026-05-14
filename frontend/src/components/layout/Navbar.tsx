'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Menu, Bell, X, User, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';

const BACKEND = 'http://localhost:5001';

export default function Navbar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.get('/notifications').then(res => setNotifications(res.data)).catch(console.error);
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await api.post('/notifications/read');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (e) {}
  };

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <header className="h-16 border-b border-white/10 bg-black/30 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-50 sticky top-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <span className="text-white font-semibold text-sm hidden sm:block">
            Welcome back, <span className="text-blue-400">{user?.name?.split(' ')[0] || 'User'}</span>
          </span>
          <span className="text-xs text-gray-500 hidden sm:block">{user?.role}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) handleMarkAsRead(); }}
            className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-semibold text-white text-sm">Notifications</h3>
                {unreadCount > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{unreadCount} new</span>}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-6 text-sm text-gray-500 text-center">All caught up! 🎉</p>
                ) : (
                  notifications.map(n => (
                    <div key={n._id} className={`p-3 border-b border-white/5 text-xs ${!n.read ? 'bg-blue-500/5 text-white' : 'text-gray-400'}`}>
                      <p>{n.message}</p>
                      <p className="text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
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
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-blue-500/50 transition-all"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="h-8 w-8 rounded-full object-cover border-2 border-white/20" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white/20">
                {initials}
              </div>
            )}
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="p-4 border-b border-white/10">
                <p className="text-white font-medium text-sm">{user?.name}</p>
                <p className="text-gray-500 text-xs">{user?.email}</p>
                <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">{user?.role}</span>
              </div>
              <div className="p-2">
                <Link href="/dashboard/profile" onClick={() => setShowProfile(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/10 text-sm transition-colors">
                  <Settings className="w-4 h-4" /> Profile Settings
                </Link>
                <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-sm transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
