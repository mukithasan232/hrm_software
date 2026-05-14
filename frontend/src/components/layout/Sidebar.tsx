'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Clock, CreditCard, LayoutDashboard, LogOut, CalendarRange, TrendingUp, X, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const BACKEND = 'http://localhost:5001';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [] },
  { name: 'Attendance', href: '/dashboard/attendance', icon: Clock, roles: [] },
  { name: 'Employees', href: '/dashboard/employees', icon: Users, roles: ['Admin', 'HR', 'Manager'] },
  { name: 'Leaves', href: '/dashboard/leaves', icon: CalendarRange, roles: [] },
  { name: 'Payroll', href: '/dashboard/payroll', icon: CreditCard, roles: ['Admin', 'HR'] },
  { name: 'Performance', href: '/dashboard/performance', icon: TrendingUp, roles: [] },
  { name: 'My Profile', href: '/dashboard/profile', icon: User, roles: [] },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredItems = NAV_ITEMS.filter(item =>
    item.roles.length === 0 || item.roles.includes(user?.role || '')
  );

  const avatarSrc = user?.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            HRM & Payroll
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Management System</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Info Card */}
      <div className="px-4 py-3 mx-3 mt-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
        {avatarSrc ? (
          <img src={avatarSrc} alt="avatar" className="h-9 w-9 rounded-full object-cover border border-white/20 flex-shrink-0" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{user?.name}</p>
          <p className="text-gray-500 text-xs truncate">{user?.role}</p>
        </div>
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
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'group-hover:text-white'}`} />
              <span>{item.name}</span>
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium"
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
      <aside className="hidden md:flex w-64 border-r border-white/10 bg-black/40 backdrop-blur-lg flex-col h-screen flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-950 border-r border-white/10 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
