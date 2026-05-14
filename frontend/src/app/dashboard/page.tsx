'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, CalendarRange, CreditCard, Award, TrendingUp } from 'lucide-react';
import api from '@/services/api';
import confetti from 'canvas-confetti';

export default function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ employees: 0, pendingLeaves: 0, eotm: null as any });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersRes = await api.get('/users');
        const leavesRes = await api.get('/leaves/all');
        const eotmRes = await api.get('/performance/eotm/latest');
        
        setStats({
          employees: usersRes.data.length || 0,
          pendingLeaves: leavesRes.data.filter((l: any) => l.status === 'Pending').length || 0,
          eotm: eotmRes.data // API returns null if no EOTM found
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) fetchDashboardData();
  }, [user]);

  useEffect(() => {
    if (stats.eotm) {
      // Trigger confetti!
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);
    }
  }, [stats.eotm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white">System Overview</h1>
        <p className="text-gray-400 mt-1">Welcome to the HRM & Payroll Control Center.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-blue-500/50 transition-colors">
          <div>
            <p className="text-sm text-gray-400 font-medium">Total Employees</p>
            <p className="text-3xl font-bold text-white mt-2">{loading ? '-' : stats.employees}</p>
          </div>
          <div className="p-4 bg-blue-500/20 rounded-xl text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-purple-500/50 transition-colors">
          <div>
            <p className="text-sm text-gray-400 font-medium">Pending Leaves</p>
            <p className="text-3xl font-bold text-white mt-2">{loading ? '-' : stats.pendingLeaves}</p>
          </div>
          <div className="p-4 bg-purple-500/20 rounded-xl text-purple-400">
            <CalendarRange className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-green-500/50 transition-colors">
          <div>
            <p className="text-sm text-gray-400 font-medium">Payroll Status</p>
            <p className="text-xl font-bold text-green-400 mt-2">Processed</p>
          </div>
          <div className="p-4 bg-green-500/20 rounded-xl text-green-400">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-orange-500/50 transition-colors">
          <div>
            <p className="text-sm text-gray-400 font-medium">Avg Performance</p>
            <p className="text-3xl font-bold text-white mt-2">92%</p>
          </div>
          <div className="p-4 bg-orange-500/20 rounded-xl text-orange-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Hall of Fame: EOTM */}
      <div className="mt-8 relative overflow-hidden rounded-3xl bg-gradient-to-r from-yellow-600/20 via-yellow-500/10 to-yellow-600/20 border border-yellow-500/30 p-8 shadow-[0_0_50px_rgba(234,179,8,0.15)]">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 text-yellow-500/10">
          <Award className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="h-32 w-32 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 p-1 shadow-2xl">
            <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center text-4xl font-bold text-yellow-500">
              {stats.eotm?.name?.charAt(0) || '★'}
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-semibold mb-3">
              <Award className="w-4 h-4" /> Hall of Fame
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight">Employee of the Month</h2>
            <div className="mt-4">
              <p className="text-2xl font-medium text-yellow-400">{stats.eotm?.name}</p>
              <p className="text-gray-400">{stats.eotm?.designation}</p>
            </div>
            <div className="mt-6 flex items-center gap-4 justify-center md:justify-start">
              <div className="px-4 py-2 bg-black/30 rounded-xl border border-yellow-500/20">
                <p className="text-xs text-gray-400">Overall Score</p>
                <p className="text-xl font-bold text-white">{stats.eotm?.score}%</p>
              </div>
              <div className="px-4 py-2 bg-black/30 rounded-xl border border-yellow-500/20">
                <p className="text-xs text-gray-400">Manager Rating</p>
                <p className="text-xl font-bold text-white">5.0 / 5.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
