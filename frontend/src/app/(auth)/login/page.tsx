'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Shield, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_HOME } from '@/components/ProtectedRoute';
import api from '@/services/api';
import toast from 'react-hot-toast';

const ROLE_COLORS: Record<string, string> = {
  Admin:     'from-red-500 to-orange-500',
  HR:        'from-purple-500 to-pink-500',
  Manager:   'from-blue-500 to-cyan-500',
  Executive: 'from-green-500 to-teal-500',
};

const ROLE_BADGES: Record<string, { label: string; desc: string; color: string }> = {
  Admin:     { label: 'Admin',     desc: 'Full system access',          color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  HR:        { label: 'HR',        desc: 'Payroll, Leaves & Staff',     color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  Manager:   { label: 'Manager',   desc: 'Team & Leave Approvals',      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  Executive: { label: 'Executive', desc: 'Personal Dashboard & Leaves', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const QUICK_LOGINS = [
  { role: 'Admin',     email: 'aiden.khan@hrm.test',        label: 'Admin' },
  { role: 'HR',        email: 'bella.smith@hrm.test',       label: 'HR' },
  { role: 'Manager',   email: 'diana.wang@hrm.test',        label: 'Manager' },
  { role: 'Executive', email: 'julia.patel@hrm.test',       label: 'Executive' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);

  const handleQuickFill = (email: string) => {
    setEmail(email);
    setPassword('password123');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, ...userData } = response.data;
      const normalizedUser = { ...userData, id: userData._id };
      login(normalizedUser, token);

      const role: string = userData.role;
      setDetectedRole(role);

      toast.success(`Welcome back, ${userData.name}!`, { icon: '👋' });

      // Role-based redirect
      const destination = ROLE_HOME[role] || '/dashboard';
      setTimeout(() => router.replace(destination), 600);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl mb-2">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">HRM Portal</h1>
          <p className="text-sm text-gray-400">Sign in to access your role-based dashboard</p>
        </div>

        {/* Quick Login Chips */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Quick Login (Testing)</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LOGINS.map(q => {
              const badge = ROLE_BADGES[q.role];
              return (
                <button
                  key={q.role}
                  type="button"
                  onClick={() => handleQuickFill(q.email)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all hover:scale-[1.02] active:scale-95 ${badge.color}`}
                >
                  <p className="font-bold">{badge.label}</p>
                  <p className="opacity-70 text-[11px] mt-0.5">{badge.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
          {/* Detected role badge */}
          {detectedRole && ROLE_BADGES[detectedRole] && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${ROLE_BADGES[detectedRole].color}`}>
              <Shield className="w-4 h-4" />
              <span>Logged in as <strong>{detectedRole}</strong> — redirecting…</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_25px_rgba(37,99,235,0.3)] transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
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

          {/* Role Access Summary */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 mb-2 font-medium">Role Access Levels</p>
            <div className="space-y-1.5">
              {Object.entries(ROLE_BADGES).map(([role, info]) => (
                <div key={role} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${info.color}`}>{info.label}</span>
                  <span>{info.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
