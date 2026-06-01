'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DESIGNATION_HOME } from '@/components/ProtectedRoute';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ─── Dynamic logo ─────────────────────────────────────────────────────────────
// Swap `systemLogo` at runtime via Admin Settings context to allow custom logo.
const systemLogo: string | null = null;

function DefaultLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className="w-7 h-7"
      aria-label="HRM Portal logo"
    >
      <path
        d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
        fill="white"
        fillOpacity="0.18"
        stroke="white"
        strokeWidth="1.5"
      />
      <path
        d="M24 12L34 17V26C34 31.5 29.5 36.1 24 38C18.5 36.1 14 31.5 14 26V17L24 12Z"
        fill="white"
        opacity="0.92"
      />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        fill="#4f46e5"
      >
        H
      </text>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

        {/* ── Logo & Title ─────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30">
            {systemLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={systemLogo} alt="Organization logo" className="w-8 h-8 object-contain" />
            ) : (
              <DefaultLogo />
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            HRM Portal
          </h1>
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
