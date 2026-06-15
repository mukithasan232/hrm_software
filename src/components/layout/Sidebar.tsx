'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, Clock, LayoutDashboard, LogOut, CalendarRange,
  X, User, UsersRound, Shield, ChevronDown, Smartphone, Megaphone, ChevronLeft, ChevronRight, HardDrive, Building2, Mail
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { useTranslation } from '@/context/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

// Nav item keys (translated at render time via t())
const NAV_ITEM_DEFS = [
  { key: 'dashboard',  href: '/dashboard',            icon: LayoutDashboard, module: 'Dashboard' },
  { key: 'attendance', href: '/dashboard/attendance', icon: Clock,           module: 'Attendance' },
  { key: 'leaves',     href: '/dashboard/leaves',     icon: CalendarRange,   module: 'Leaves' },
  { key: 'announcements', href: '/dashboard/announcements', icon: Megaphone, module: 'Announcements' },
  { key: 'myProfile',  href: '/dashboard/profile',    icon: User,            module: 'Profile' },
];

const TEAM_SUB_DEFS = [
  { key: 'designations', href: '/dashboard/team/designations', icon: Shield, module: 'Designations' },
  { key: 'departments',  href: '/dashboard/team/departments',  icon: Building2, module: 'Departments' },
  { key: 'users',        href: '/dashboard/team/users',        icon: UsersRound, module: 'Users' },
  { key: 'employees',    href: '/dashboard/team/employees',    icon: Users, module: 'Employees' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { brand } = useBrand();
  const { t } = useTranslation();
  const { can } = usePermissions();

  // Keep Team section open if we're on a /team/* route
  const isTeamActive = pathname.startsWith('/dashboard/team');
  const [teamOpen, setTeamOpen] = useState(isTeamActive);
  const [logoError, setLogoError] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const collapsed = !mobileOpen && isCollapsed;

  const filteredItems = NAV_ITEM_DEFS.filter(item => {
    if (item.module === 'Dashboard' || item.module === 'Profile') return true;
    return can(item.module, 'canRead');
  });

  const filteredTeamItems = TEAM_SUB_DEFS.filter(sub => can(sub.module, 'canRead'));
  const canSeeTeam = filteredTeamItems.length > 0;

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`p-5 border-b border-slate-200 dark:border-white/10 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} transition-all`}>
        <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'hidden' : ''}`}>
          {brand.logoUrl && !logoError ? (
            <img
              src={brand.logoUrl.startsWith('http') || brand.logoUrl.startsWith('data:') 
                ? brand.logoUrl 
                : `${BACKEND}${brand.logoUrl}?t=${Date.now()}`}
              alt={brand.companyName || 'Logo'}
              className="h-8 max-w-[140px] object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-white font-extrabold text-2xl tracking-widest block py-2">HRM</span>
          )}
        </div>

        {/* Toggle Button for Desktop */}
        {!mobileOpen && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors ${collapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}

        {/* Mobile Close Button */}
        {mobileOpen && onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>



      {/* Nav Items */}
      <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
        {filteredItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 py-2.5 rounded-xl transition-all text-sm font-medium group relative ${
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-sm shadow-brand-primary/20'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              } ${collapsed ? 'justify-center px-0 mx-2' : 'px-4'}`}
            >
              <Icon
                className={`h-5 w-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-brand-primary' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white'
                }`}
              />
              {!collapsed && <span className="capitalize">{t(item.key as any)}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-brand-primary" />
              )}
              
              {/* Tooltip */}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700 capitalize">
                  {t(item.key as any)}
                </span>
              )}
            </Link>
          );
        })}


        {/* ── Team Section (Admin / Superadmin only) ── */}
        {canSeeTeam && (
          <div className="pt-1">

            {/* Team accordion trigger */}
            <button
              onClick={() => setTeamOpen(prev => !prev)}
              className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all text-sm font-medium group relative ${
                isTeamActive
                  ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              } ${collapsed ? 'justify-center px-0 mx-2' : 'px-4'}`}
            >
              <UsersRound
                className={`h-5 w-5 flex-shrink-0 transition-colors ${
                  isTeamActive ? 'text-indigo-500' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white'
                }`}
              />
              {!collapsed && <span className="flex-1 text-left capitalize">{t('team')}</span>}
              {!collapsed && (
                <ChevronDown
                  className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${teamOpen ? 'rotate-180' : ''} ${
                    isTeamActive ? 'text-indigo-500' : 'text-slate-400 dark:text-gray-500'
                  }`}
                />
              )}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700 capitalize">
                  {t('team')}
                </span>
              )}
            </button>

            {/* Sub-items with animated height */}
            <div
              style={{
                maxHeight: teamOpen ? '200px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.25s ease',
              }}
            >
              <div className={`${collapsed ? 'mt-1 space-y-1 mx-2' : 'ml-4 mt-1 space-y-0.5 border-l border-slate-200 dark:border-white/10 pl-3'}`}>
                {filteredTeamItems.map(sub => {
                  const isSubActive = pathname === sub.href || pathname.startsWith(sub.href);
                  const SubIcon = sub.icon;
                  return (
                    <Link
                      key={sub.key}
                      href={sub.href}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 py-2 rounded-lg transition-all text-sm font-medium group relative ${
                        isSubActive
                          ? 'bg-indigo-500/10 text-indigo-500'
                          : 'text-slate-500 dark:text-gray-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                      } ${collapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                      <SubIcon className={`h-4 w-4 flex-shrink-0 ${isSubActive ? 'text-indigo-500' : ''}`} />
                      {!collapsed && <span className="capitalize">{(sub as any).label || t(sub.key as any)}</span>}
                      {!collapsed && isSubActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                      
                      {collapsed && (
                        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700 capitalize">
                          {(sub as any).label || t(sub.key as any)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={`p-3 border-t border-slate-200 dark:border-white/10 space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Mobile App Download Card */}
        <a
          href="https://drive.google.com/file/d/16FpY6WfJG6HB6EPgEU4vdRVqAGx0A02c/view?usp=drive_link"
          download="HRM-App.apk"
          className={`flex items-center gap-3 py-2.5 border border-brand-primary/20 rounded-xl transition-all group relative ${
            collapsed 
              ? 'justify-center w-10 h-10 px-0 bg-brand-primary/10 hover:bg-brand-primary/20' 
              : 'px-3 w-full text-left bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10 hover:from-brand-primary/20 hover:to-brand-secondary/20'
          }`}
        >
          <div className={`${collapsed ? '' : 'p-1.5 bg-brand-primary/20'} text-brand-primary rounded-lg group-hover:scale-110 transition-transform`}>
            <Smartphone className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-brand-primary/80">
                {t('download')}
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                {t('androidApp')}
              </p>
            </div>
          )}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700">
              {t('androidApp')}
            </span>
          )}
        </a>

        <button
          onClick={logout}
          className={`flex items-center gap-3 py-2.5 text-red-500 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium group relative ${
            collapsed ? 'justify-center w-10 h-10 px-0' : 'px-4 w-full text-left'
          }`}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>{t('signOut')}</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700">
              {t('signOut')}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/40 backdrop-blur-lg flex-col h-screen flex-shrink-0 transition-all duration-300 ease-in-out z-40`}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 flex flex-col transition-colors duration-300">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
