'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { checkPermission } from '@/utils/checkPermission';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else {
        const hasSettingsPermission = user?.email === 'dev@fixanyphoto.com' ||
          user?.role === 'SUPER_ADMIN' ||
          user?.roles?.some((r: any) => r?.name === 'SUPER_ADMIN') ||
          checkPermission(user, 'manage_system_settings', 'view');

        if (!hasSettingsPermission) {
          toast.error('Access Denied: You do not have permission to view System Settings.');
          router.replace('/dashboard');
        }
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  const hasSettingsPermission = user?.email === 'dev@fixanyphoto.com' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.roles?.some((r: any) => r?.name === 'SUPER_ADMIN') ||
    checkPermission(user, 'manage_system_settings', 'view');

  if (!hasSettingsPermission) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
