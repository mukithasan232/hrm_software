'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ChevronRight, ArrowLeft } from 'lucide-react';
import { useBrand } from '@/context/BrandContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { brand, isLoading: brandLoading } = useBrand();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const logoUrl = brand?.logoUrl;

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('If that email exists, a reset link has been sent.', { icon: '📧' });
      setTimeout(() => router.push('/login'), 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to request password reset');
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
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Forgot Password?</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-2">Enter your email address or employee ID and we will send you a link to reset your password.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-gray-500" />
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email or Employee ID"
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_28px_rgba(79,70,229,0.35)] transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                <>Send Reset Link <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

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
