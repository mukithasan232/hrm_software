'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { checkPermission } from '@/utils/checkPermission';

interface PageGuardProps {
  children: React.ReactNode;
  moduleName: string;
}

export default function PageGuard({ children, moduleName }: PageGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && !checkPermission(user, moduleName, 'view')) {
        router.replace('/');
      } else if (!user) {
        router.replace('/login');
      }
    }
  }, [user, loading, moduleName, router]);

  if (loading || !user || !checkPermission(user, moduleName, 'view')) {
    // Optionally return a loading skeleton or null while checking/redirecting
    return null;
  }

  return <>{children}</>;
}
