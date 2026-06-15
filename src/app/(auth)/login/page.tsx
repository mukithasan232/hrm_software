'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { DESIGNATION_HOME } from '@/components/ProtectedRoute';
import api from '@/services/api';
import toast from 'react-hot-toast';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const logoUrl = brand?.logoUrl;

  const handleLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, ...userData } = response.data;
      const normalizedUser = { ...userData, id: userData.id || userData._id };
      login(normalizedUser, token);

      toast.success(`Welcome back, ${userData.name}!`, { icon: '👋' });

      const destination = DESIGNATION_HOME[userData.designation as string] || '/dashboard';
      setTimeout(() => router.replace(destination), 600);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
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
              <div className="h-6 w-32 bg-slate-200 dark:bg-white/10 rounded-md"></div>
            </div>
          ) : (!logoUrl || logoError) ? (
            <div className="flex flex-col items-center justify-center gap-3 mb-6">
              <span className="text-white font-extrabold text-2xl tracking-widest block py-2">HRM</span>
            </div>
          ) : (
            <img 
              src={logoUrl.startsWith('http') || logoUrl.startsWith('data:') 
                ? logoUrl 
                : `${BACKEND}${logoUrl}?v=${brand?.updatedAt ? new Date(brand.updatedAt).getTime() : ''}`} 
              alt="Logo" 
              className="h-12 w-auto object-contain mx-auto mb-6"
              onError={() => setLogoError(true)} 
            />
          )}
        </div>

        {/* ── Login Form ───────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-md dark:shadow-2xl space-y-4 backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-gray-500" />
              <input
                id="login-email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email or Employee ID"
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold"
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-gray-500" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-semibold"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_28px_rgba(79,70,229,0.35)] transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>Sign In <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
