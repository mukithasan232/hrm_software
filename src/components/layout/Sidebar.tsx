'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, Clock, LayoutDashboard, LogOut, CalendarRange,
  X, User, UsersRound, Shield, ChevronDown, Smartphone
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';

const BACKEND = 'http://localhost:5001';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  designations: string[];
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard',  href: '/dashboard',            icon: LayoutDashboard, designations: [] },
  { name: 'Attendance', href: '/dashboard/attendance', icon: Clock,           designations: [] },
  { name: 'Leaves',     href: '/dashboard/leaves',     icon: CalendarRange,   designations: [] },
  { name: 'My Profile', href: '/dashboard/profile',    icon: User,            designations: [] },
];

const TEAM_SUB_ITEMS = [
  { name: 'Designations', href: '/dashboard/team/designations', icon: Shield },
  { name: 'Users',       href: '/dashboard/team/users', icon: UsersRound },
  { name: 'Employees',   href: '/dashboard/team/employees', icon: Users },
];

const TEAM_ALLOWED_DESIGNATIONS = ['Admin', 'Super Admin', 'System Administrator'];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { brand } = useBrand();

  // Keep Team section open if we're on a /team/* route
  const isTeamActive = pathname.startsWith('/dashboard/team');
  const [teamOpen, setTeamOpen] = useState(isTeamActive);

  const designationName = typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation;

  const filteredItems = NAV_ITEMS.filter(item =>
    item.designations.length === 0 || item.designations.includes(designationName || '')
  );

  const canSeeTeam = TEAM_ALLOWED_DESIGNATIONS.includes(designationName || '');

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.companyName}
              className="h-8 max-w-[140px] object-contain"
            />
          ) : (
            <div>
              <h2
                className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary"
              >
                {brand.companyName?.replace('Portal', '').trim() || brand.companyName}
              </h2>
            </div>
          )}
        </div>
        {onClose && (
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
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium group ${
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-sm shadow-brand-primary/20'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon
                className={`h-4 w-4 flex-shrink-0 transition-colors ${
                  isActive ? 'text-brand-primary' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white'
                }`}
              />
              <span>{item.name}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-brand-primary" />
              )}
            </Link>
          );
        })}

        {/* ── Team Section (Admin / Superadmin only) ── */}
        {canSeeTeam && (
          <div className="pt-1">
            {/* Separator label */}
            <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-gray-600">
              Administration
            </p>

            {/* Team accordion trigger */}
            <button
              onClick={() => setTeamOpen(prev => !prev)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium group ${
                isTeamActive
                  ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UsersRound
                className={`h-4 w-4 flex-shrink-0 transition-colors ${
                  isTeamActive ? 'text-indigo-500' : 'text-slate-400 dark:text-gray-500 group-hover:text-slate-900 dark:group-hover:text-white'
                }`}
              />
              <span className="flex-1 text-left">Team</span>
              <ChevronDown
                className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${teamOpen ? 'rotate-180' : ''} ${
                  isTeamActive ? 'text-indigo-500' : 'text-slate-400 dark:text-gray-500'
                }`}
              />
            </button>

            {/* Sub-items with animated height */}
            <div
              style={{
                maxHeight: teamOpen ? '200px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.25s ease',
              }}
            >
              <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 dark:border-white/10 pl-3">
                {TEAM_SUB_ITEMS.map(sub => {
                  const isSubActive = pathname === sub.href || pathname.startsWith(sub.href);
                  const SubIcon = sub.icon;
                  return (
                    <Link
                      key={sub.name}
                      href={sub.href}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm font-medium group ${
                        isSubActive
                          ? 'bg-indigo-500/10 text-indigo-500'
                          : 'text-slate-500 dark:text-gray-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <SubIcon className={`h-3.5 w-3.5 flex-shrink-0 ${isSubActive ? 'text-indigo-500' : ''}`} />
                      <span>{sub.name}</span>
                      {isSubActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-white/10 space-y-2">
        {/* Mobile App Download Card */}
        <a
          href="/apps/hrm-mobile.apk"
          download="hrm-mobile.apk"
          className="flex items-center gap-3 px-3 py-2.5 w-full text-left bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10 hover:from-brand-primary/20 hover:to-brand-secondary/20 border border-brand-primary/20 rounded-xl transition-all group"
        >
          <div className="p-1.5 bg-brand-primary/20 text-brand-primary rounded-lg group-hover:scale-110 transition-transform">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-brand-primary/80">
              Download
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
              Android App
            </p>
          </div>
        </a>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-red-500 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-black/40 backdrop-blur-lg flex-col h-screen flex-shrink-0 transition-colors duration-300">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 flex flex-col transition-colors duration-300">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
