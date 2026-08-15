'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Settings, X, ChevronLeft, ChevronRight, BarChart
} from 'lucide-react';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart },
  { key: 'users', label: 'Users', href: '/users', icon: Users },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState) {
      try {
        setIsCollapsed(JSON.parse(savedState));
      } catch (e) {}
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
      return newState;
    });
  };

  const collapsed = !mobileOpen && isCollapsed;

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`h-16 w-full flex-shrink-0 flex items-center ${collapsed ? 'justify-center' : 'justify-start'} overflow-hidden border-b border-slate-200 dark:border-white/10 px-5 transition-all`}>
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden h-full w-full">
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md flex-shrink-0">
              B
            </div>
          ) : (
            <span className="text-slate-800 dark:text-white font-extrabold text-lg sm:text-2xl tracking-widest block py-1 sm:py-2 text-left leading-tight truncate w-full h-8 flex items-center overflow-hidden">
              BOILERPLATE
            </span>
          )}
        </div>

        {/* Mobile Close Button */}
        {mobileOpen && onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white flex-shrink-0 ml-auto">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Items Container */}
      <div className="flex-1 overflow-y-auto w-full">
        <nav className="px-3 mt-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || (item.href !== '/' && (pathname?.startsWith(item.href) ?? false));
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 py-2.5 rounded-xl transition-all text-sm font-medium group relative ${isActive
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-white border border-indigo-500/20 shadow-sm shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  } ${collapsed ? 'justify-center px-0 mx-2' : 'px-4'}`}
              >
                <Icon
                  className={`h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-white' : 'text-slate-400 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white'
                    }`}
                />
                {!collapsed && <span className="capitalize">{item.label}</span>}
                {!collapsed && isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-indigo-600" />
                )}

                {/* Tooltip */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700 capitalize">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className={`p-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2 ${collapsed ? 'items-center' : ''}`}>
        {/* Toggle Button for Desktop */}
        {!mobileOpen && (
          <button
            onClick={toggleSidebar}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-all flex items-center justify-center w-full"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );

  if (!isMounted) {
    return (
      <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/40 backdrop-blur-lg flex-col h-screen flex-shrink-0 transition-all duration-300 ease-in-out z-40`}>
        <div className="flex flex-col h-full animate-pulse p-4 space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/40 backdrop-blur-lg flex-col h-screen flex-shrink-0 transition-all duration-300 ease-in-out z-40`}>
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${mobileOpen ? 'visible' : 'invisible'}`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 flex flex-col transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <SidebarContent />
        </aside>
      </div>
    </>
  );
}
