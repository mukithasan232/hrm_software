'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Users, Clock, LayoutDashboard, LogOut, CalendarRange,
  X, User, UsersRound, Shield, ChevronDown, Smartphone, Megaphone, ChevronLeft, ChevronRight, HardDrive, Building2, Mail, CheckSquare, Volume2
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { useTranslation } from '@/context/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { checkPermission } from '@/utils/checkPermission';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

// Nav item keys (translated at render time via t())
const NAV_ITEM_DEFS = [
  { key: 'dashboard',    href: '/dashboard',            icon: LayoutDashboard, module: 'Dashboard'    },
  { key: 'attendance',   href: '/dashboard/attendance', icon: Clock,           module: 'Attendance'   },
  { key: 'leaves',       href: '/dashboard/leaves',     icon: CalendarRange,   module: 'Leaves'       },
  { key: 'announcements',href: '/dashboard/announcements', icon: Megaphone,   module: 'Announcements'},
  { key: 'tasks',        href: '/dashboard/tasks',      icon: CheckSquare,     module: 'Tasks'        },
  { key: 'myProfile',    href: '/dashboard/profile',    icon: User,            module: 'Profile'      },
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
  const { user, logout, loading } = useAuth();
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
    return checkPermission(user, item.module.toLowerCase(), 'access');
  });

  const filteredTeamItems = TEAM_SUB_DEFS.filter(sub => checkPermission(user, sub.module.toLowerCase(), 'access'));
  const canSeeTeam = filteredTeamItems.length > 0;

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const isAdminUser = user && ['Admin', 'Super Admin', 'System Administrator'].includes(
    typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`h-16 w-full flex-shrink-0 flex items-center ${collapsed ? 'justify-center' : 'justify-start'} overflow-hidden border-b border-slate-200 dark:border-white/10 px-5 transition-all`}>
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden h-full w-full">
          {collapsed ? (
            brand.faviconUrl ? (
              <Image
                src={brand.faviconUrl}
                alt="Icon"
                width={32}
                height={32}
                priority={true}
                unoptimized={true}
                className="h-8 w-8 object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md flex-shrink-0">
                {brand.companyName ? brand.companyName.charAt(0).toUpperCase() : 'H'}
              </div>
            )
          ) : brand.logoUrl && !logoError ? (
            <Image
              src={brand.logoUrl}
              alt={brand.companyName || 'Logo'}
              width={140}
              height={32}
              priority={true}
              unoptimized={true}
              className="h-8 max-w-[140px] object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-slate-800 dark:text-white font-extrabold text-2xl tracking-widest block py-2 text-center leading-tight">
              {brand?.companyName || 'FIX ANY PHOTO'}
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

        {/* ── Settings Section (Admin / Superadmin only) ── */}
        {isAdminUser && (
          <div className="pt-1">
             <Link
               href="/dashboard/settings/notifications"
               onClick={onClose}
               className={`flex items-center gap-3 py-2.5 rounded-xl transition-all text-sm font-medium group relative ${
                 pathname.startsWith('/dashboard/settings')
                   ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-sm shadow-brand-primary/20'
                   : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
               } ${collapsed ? 'justify-center px-0 mx-2' : 'px-4'}`}
             >
               <Volume2
                 className={`h-5 w-5 flex-shrink-0 transition-colors ${
                   pathname.startsWith('/dashboard/settings') ? 'text-brand-primary' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white'
                 }`}
               />
               {!collapsed && <span className="capitalize">Admin Settings</span>}
               {!collapsed && pathname.startsWith('/dashboard/settings') && (
                 <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-brand-primary" />
               )}
               {collapsed && (
                 <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl border border-slate-700 capitalize">
                   Admin Settings
                 </span>
               )}
             </Link>
          </div>
        )}
      </nav>
      </div>

      {/* Footer */}
      <div className={`p-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2 ${collapsed ? 'items-center' : ''}`}>
        {!collapsed && (
          <>
            {/* Mobile App Download Card */}
            <a
              href="https://drive.google.com/file/d/16FpY6WfJG6HB6EPgEU4vdRVqAGx0A02c/view?usp=drive_link"
              download="HRM-App.apk"
              className="flex items-center gap-3 py-2.5 border border-brand-primary/20 rounded-xl transition-all group relative px-3 w-full text-left bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10 hover:from-brand-primary/20 hover:to-brand-secondary/20"
            >
              <div className="p-1.5 bg-brand-primary/20 text-brand-primary rounded-lg group-hover:scale-110 transition-transform">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-brand-primary/80">
                  {t('download')}
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                  {t('androidApp')}
                </p>
              </div>
            </a>

            <button
              onClick={logout}
              className="flex items-center gap-3 py-2.5 px-4 w-full text-left text-red-500 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium group relative"
            >
              <LogOut className="h-5 w-5" />
              <span>{t('signOut')}</span>
            </button>
          </>
        )}

        {/* Toggle Button for Desktop - Moved to Bottom */}
        {!mobileOpen && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-all flex items-center justify-center w-full"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}

        {/* Dynamic Copyright Section */}
        {!collapsed && (
          <div className="mt-auto pt-4 pb-1 px-4 text-center">
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 leading-tight">
              &copy; {new Date().getFullYear()} Fix Any Photo.<br/>
              All rights reserved.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/40 backdrop-blur-lg flex-col h-screen flex-shrink-0 transition-all duration-300 ease-in-out z-40`}>
        <div className="flex flex-col h-full animate-pulse p-4 space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
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

      {/* Mobile Drawer (Animated) */}
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
