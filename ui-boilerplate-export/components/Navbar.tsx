'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, Menu, LayoutGrid, ExternalLink } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ onMobileMenuToggleAction }: { onMobileMenuToggleAction?: () => void }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showApps, setShowApps] = useState(false);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);

  const unreadCount = 3;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (appsRef.current && !appsRef.current.contains(e.target as Node)) setShowApps(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
          <div className="hidden md:flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">
              Good Morning, User
            </span>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* App Launcher */}
        <div className="relative" ref={appsRef}>
          <button 
            onClick={() => setShowApps(!showApps)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          {showApps && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50">
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((app) => (
                  <button 
                    key={app}
                    className="flex flex-col items-center justify-center p-3 gap-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                  >
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium text-center truncate w-full">
                      App {app}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notification Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full animate-pulse bg-indigo-600" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-700/50 rounded-2xl shadow-xl dark:shadow-lg dark:shadow-black/20 overflow-hidden z-50 flex flex-col max-h-[32rem]">
              <div className="p-4 border-b border-slate-100 dark:border-white/10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">Notifications</h3>
                  <div className="flex items-center gap-2">
                    <button className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
                      Mark all read
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
                {[1, 2, 3].map(n => (
                  <div key={n} className="relative p-3 mb-1 rounded-xl transition-colors duration-150 flex gap-3 block cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700">
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <div className="flex-1 pl-2">
                      <p className="text-[13px] leading-tight font-bold text-slate-900 dark:text-white">
                        Sample Notification {n}
                      </p>
                      <p className="text-xs mt-1 leading-snug text-slate-700 dark:text-gray-300">
                        This is a sample notification message.
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        Just now
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar / Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`flex items-center gap-2 p-1 rounded-full transition-all ${showProfile ? 'ring-2 ring-indigo-500/60' : ''}`}
          >
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white/20 bg-gradient-to-tr from-indigo-500 to-purple-500">
              U
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-700/50 rounded-2xl shadow-xl dark:shadow-lg dark:shadow-black/20 overflow-hidden z-50">
              <div className="p-4 border-b border-slate-100 dark:border-white/10">
                <p className="text-slate-800 dark:text-white font-medium text-sm">Demo User</p>
                <p className="text-slate-500 dark:text-gray-500 text-xs mt-0.5">user@example.com</p>
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-500">
                  Admin
                </span>
              </div>
              <div className="p-2">
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 text-sm transition-colors">
                  Profile Settings
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/5 dark:hover:bg-gray-700 text-sm transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
