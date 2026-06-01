'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Define which designations can access each route prefix
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/payroll':     ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Engineering Manager', 'Finance Manager', 'Operations Manager', 'Sales Manager', 'Marketing Manager'],
  '/dashboard/employees':   ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'],
  '/dashboard/performance': ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Stakeholder', 'Employee'],
  '/dashboard/leaves':      ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Employee'],
  '/dashboard/attendance':  ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Employee'],
  '/dashboard/profile':     ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Stakeholder', 'Employee'],
  '/dashboard':             ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Stakeholder', 'Employee'],
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
          Your designation (<span className="text-blue-400 font-semibold">{designation}</span>) does not have
          permission to access <span className="text-red-400">{path}</span>.
        </p>
        <a
          href={DESIGNATION_HOME[designation] || '/dashboard'}
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
  allowedDesignations?: string[]; // optional page-level override
}

export default function ProtectedRoute({ children, allowedDesignations }: ProtectedRouteProps) {
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
  const designation = user.designation || 'Employee';

  // If caller passed explicit allowedDesignations, use those
  const requiredDesignations = allowedDesignations ?? getRequiredDesignations(pathname);

  if (requiredDesignations && requiredDesignations.length > 0 && !requiredDesignations.includes(designation)) {
    return getAccessDenied(designation, pathname);
  }

  return <>{children}</>;
}

function getRequiredDesignations(pathname: string): string[] | null {
  // Match the most specific prefix first
  const sorted = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);
  for (const route of sorted) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return ROUTE_PERMISSIONS[route];
    }
  }
  return null; // No restriction
}
