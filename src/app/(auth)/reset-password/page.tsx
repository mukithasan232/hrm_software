'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ChevronRight, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useBrand } from '@/context/BrandContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const { brand, isLoading: brandLoading } = useBrand();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const logoUrl = brand?.logoUrl;

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!token) {
      toast.error('Reset token is missing from URL.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password has been successfully reset!', { icon: '🎉' });
      setTimeout(() => router.push('/login'), 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-transparent">
      {/* Ambient background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/5 dark:bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-6">

        {/* Logo area */}
        <div className="text-center space-y-3">
          {brandLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 mb-6 animate-pulse">
              <div className="h-12 w-12 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
            </div>
          ) : (!logoUrl || logoError) ? (
            <div className="flex flex-col items-center justify-center gap-3 mb-6">
              <span className="text-white font-extrabold text-2xl tracking-widest block py-2 text-center leading-tight">
                {brand?.companyName || 'FIX ANY PHOTO'}
              </span>
            </div>
          ) : (
            <img 
              src={logoUrl.startsWith('http') || logoUrl.startsWith('data:') 
                ? logoUrl 
                : `${BACKEND}${logoUrl}?t=${Date.now()}`} 
              alt="Logo" 
              className="h-12 w-auto object-contain mx-auto mb-6"
              onError={() => setLogoError(true)}
            />
          )}
        </div>

        {/* Form Area */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-md dark:shadow-2xl space-y-4 backdrop-blur-sm">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Reset Password</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-2">Enter your new password below.</p>
          </div>

          {!token ? (
            <div className="text-center py-4">
              <p className="text-red-500 font-semibold mb-4">Invalid or missing reset token.</p>
              <Link href="/forgot-password" className="text-blue-500 hover:text-blue-600 font-medium">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-gray-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_28px_rgba(79,70,229,0.35)] transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting...
                  </span>
                ) : (
                  <>Reset Password <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
