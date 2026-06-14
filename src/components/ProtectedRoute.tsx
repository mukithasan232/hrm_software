'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

// Define which module is required for each route prefix
const ROUTE_MODULES: Record<string, string> = {
  '/dashboard/payroll':     'Payroll',
  '/dashboard/performance': 'Performance',
  '/dashboard/leaves':      'Leaves',
  '/dashboard/attendance':  'Attendance',
  '/dashboard/announcements': 'Announcements',
  '/dashboard/team/users':  'Users',
  '/dashboard/team/designations': 'Designations',
  '/dashboard/team/departments': 'Departments',
  '/dashboard/team/employees': 'Employees',
  '/dashboard/team':        'Users',
  '/dashboard/employees':   'Employees',
  '/dashboard/profile':     'Profile',
  '/dashboard':             'Dashboard',
};

// Where each designation lands after login
export const DESIGNATION_HOME: Record<string, string> = {
  Admin:                  '/dashboard',
  'Super Admin':          '/dashboard',
  'System Administrator': '/dashboard',
  Stakeholder:            '/dashboard',
  'HR Manager':           '/dashboard',
  Employee:               '/dashboard',
};

function getSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Authenticating...</p>
      </div>
    </div>
  );
}

function getAccessDenied(designation: string, path: string) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-gray-400">
          Your current roles do not grant permission to access <span className="text-red-400">{path}</span>.
        </p>
        <a
          href={'/dashboard'}
          className="inline-block mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all"
        >
          Go to My Dashboard
        </a>
      </div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedDesignations?: string[]; // Kept for legacy support
}

export default function ProtectedRoute({ children, allowedDesignations }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  const loading = authLoading || permsLoading;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return getSpinner();
  if (!isAuthenticated || !user) return null;

  const designation = user.designation || 'Employee';

  // Legacy override if explicit array is passed
  if (allowedDesignations && allowedDesignations.length > 0) {
    if (!allowedDesignations.includes(designation)) {
      return getAccessDenied(designation, pathname);
    }
  }

  // Multi-Role Granular check
  const moduleName = getRequiredModule(pathname);

  if (moduleName && moduleName !== 'Dashboard' && moduleName !== 'Profile') {
    if (!can(moduleName, 'canRead')) {
      return getAccessDenied(designation, pathname);
    }
  }

  return <>{children}</>;
}

function getRequiredModule(pathname: string): string | null {
  // Match the most specific prefix first
  const sorted = Object.keys(ROUTE_MODULES).sort((a, b) => b.length - a.length);
  for (const route of sorted) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return ROUTE_MODULES[route];
    }
  }
  return null; // No restriction
}
