'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Define which roles can access each route prefix
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/payroll':     ['Admin', 'HR'],
  '/dashboard/employees':   ['Admin', 'HR', 'Manager'],
  '/dashboard/performance': ['Admin', 'HR', 'Manager', 'Executive'],
  '/dashboard/leaves':      ['Admin', 'HR', 'Manager', 'Executive'],
  '/dashboard/attendance':  ['Admin', 'HR', 'Manager', 'Executive'],
  '/dashboard/profile':     ['Admin', 'HR', 'Manager', 'Executive'],
  '/dashboard':             ['Admin', 'HR', 'Manager', 'Executive'],
};

// Where each role lands after login
export const ROLE_HOME: Record<string, string> = {
  Admin:     '/dashboard',
  HR:        '/dashboard',
  Manager:   '/dashboard',
  Executive: '/dashboard',
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

function getAccessDenied(role: string, path: string) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-gray-400">
          Your role (<span className="text-blue-400 font-semibold">{role}</span>) does not have
          permission to access <span className="text-red-400">{path}</span>.
        </p>
        <a
          href={ROLE_HOME[role] || '/dashboard'}
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
  allowedRoles?: string[]; // optional page-level override
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return getSpinner();
  if (!isAuthenticated || !user) return null;

  // Check route-level permissions
  const role = user.role;

  // If caller passed explicit allowedRoles, use those
  const requiredRoles = allowedRoles ?? getRequiredRoles(pathname);

  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(role)) {
    return getAccessDenied(role, pathname);
  }

  return <>{children}</>;
}

function getRequiredRoles(pathname: string): string[] | null {
  // Match the most specific prefix first
  const sorted = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);
  for (const route of sorted) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return ROUTE_PERMISSIONS[route];
    }
  }
  return null; // No restriction
}
