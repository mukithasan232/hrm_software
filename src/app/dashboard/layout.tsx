'use client';
import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import GlobalDetailsDrawer from '@/components/ui/DetailsDrawer';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  
  // Safe check for banner display
  const isAdminOrHR = user?.roles?.some(r => ['admin', 'super admin', 'hr'].includes(r.name?.toLowerCase())) || ['Admin', 'Super Admin', 'HR'].includes(user?.designation || '');
  
  const showBanner = user && !isAdminOrHR && (user as any).verificationStatus !== 'ACTIVE';

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-transparent transition-colors duration-300">
        <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Navbar onMobileMenuToggleAction={() => setMobileMenuOpen(!mobileMenuOpen)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-20 p-4 sm:p-6 lg:p-8 relative">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] -z-10" />
            
            {showBanner && (
              <div className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-amber-800 dark:text-amber-500 font-semibold text-sm">Action Required</h3>
                    <p className="text-amber-700 dark:text-amber-600 text-sm">Your account is missing mandatory verification documents.</p>
                  </div>
                </div>
                <Link href="/onboarding" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                  Upload Now
                </Link>
              </div>
            )}

            {children}
          </main>
        </div>
      </div>
      <GlobalDetailsDrawer />
    </ProtectedRoute>
  );
}
