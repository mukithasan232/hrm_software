'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, CalendarRange, CreditCard, Award, TrendingUp, RefreshCw, Clock } from 'lucide-react';
import api from '@/services/api';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

export default function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ 
    employees: 0, 
    pendingLeaves: 0, 
    activeNow: 0,
    totalToday: 0,
    eotm: null as any 
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingUsers, setSyncingUsers] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [usersRes, leavesRes, eotmRes, presenceRes] = await Promise.all([
        api.get('/users'),
        api.get('/leaves/all'),
        api.get('/performance/eotm/latest'),
        api.get('/attendance/active-today')
      ]);
      
      setStats({
        employees: usersRes.data.length || 0,
        pendingLeaves: leavesRes.data.filter((l: any) => l.status === 'Pending').length || 0,
        activeNow: presenceRes.data.activeNow || 0,
        totalToday: presenceRes.data.totalToday || 0,
        eotm: eotmRes.data
      });
      setRecentAttendance(presenceRes.data.recent || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Real-time listener
      const socketUrl = process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
        : '';
      const socket = io(socketUrl);
      
      socket.on('new-attendance', (log) => {
        setStats(prev => ({ ...prev, activeNow: log.punchType === 'CheckIn' ? prev.activeNow + 1 : prev.activeNow }));
        setRecentAttendance(prev => [log, ...prev].slice(0, 5));
      });

      socket.on('attendanceUpdate', () => {
        console.log('🔄 Attendance update received from device socket, refreshing dashboard data...');
        fetchDashboardData();
      });

      return () => { socket.disconnect(); };
    }
  }, [user]);

  const handleSyncUsers = async () => {
    try {
      setSyncingUsers(true);
      const res = await api.post('/attendance/sync-users');
      toast.success(res.data.message || 'Users synced from device!');
      fetchDashboardData();
    } catch (error: any) {
      toast.error('Failed to sync users from biometric device');
    } finally {
      setSyncingUsers(false);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">System Overview</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Welcome to the HRM & Payroll Control Center.</p>
        </div>
        <button 
          onClick={handleSyncUsers}
          disabled={syncingUsers}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 disabled:opacity-50 font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${syncingUsers ? 'animate-spin' : ''}`} /> 
          {syncingUsers ? 'Syncing Users...' : 'Sync Device Users'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Present Now</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{loading ? '-' : stats.activeNow}</p>
            </div>
          </div>
          <div className="p-4 bg-emerald-500/20 rounded-xl text-emerald-500 dark:text-emerald-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Total Employees</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{loading ? '-' : stats.employees}</p>
          </div>
          <div className="p-4 bg-blue-500/20 rounded-xl text-blue-500 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Pending Leaves</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{loading ? '-' : stats.pendingLeaves}</p>
          </div>
          <div className="p-4 bg-purple-500/20 rounded-xl text-purple-500 dark:text-purple-400">
            <CalendarRange className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-green-500/50 dark:hover:border-green-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Payroll Status</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-2">Processed</p>
          </div>
          <div className="p-4 bg-green-500/20 rounded-xl text-green-500 dark:text-green-400">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-orange-500/50 dark:hover:border-orange-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Avg Performance</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">92%</p>
          </div>
          <div className="p-4 bg-orange-500/20 rounded-xl text-orange-500 dark:text-orange-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Hall of Fame & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-r from-yellow-500/10 via-yellow-400/5 to-yellow-500/10 dark:from-yellow-600/20 dark:via-yellow-500/10 dark:to-yellow-600/20 border border-yellow-500/30 p-8 shadow-md dark:shadow-[0_0_50px_rgba(234,179,8,0.15)]">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 text-yellow-500/10">
            <Award className="w-64 h-64" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 p-1 shadow-2xl">
              <div className="h-full w-full rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-3xl font-bold text-yellow-600 dark:text-yellow-500">
                {stats.eotm?.name?.charAt(0) || '★'}
              </div>
            </div>
            
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs font-semibold mb-2">
                <Award className="w-3 h-3" /> Hall of Fame
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Employee of the Month</h2>
              <p className="text-yellow-600 dark:text-yellow-400 font-semibold text-lg">{stats.eotm?.name || 'TBD'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-md dark:shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Activity
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg">Real-Time</span>
          </div>

          <div className="space-y-4 flex-1">
            {recentAttendance.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 gap-2 opacity-50">
                <Clock className="w-8 h-8" />
                <p className="text-sm italic">Waiting for punches...</p>
              </div>
            ) : (
              recentAttendance.map((log, i) => (
                <div key={log.id || i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 animate-in slide-in-from-right-4 duration-300">
                  {/* Text Grouping Container */}
                  <div className="flex flex-col gap-1 min-w-0 max-w-[75%]">
                    {/* Muted Small ID */}
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono truncate block">
                      {log.employeeId}
                    </span>
                    {/* Employee Name */}
                    <span className="font-semibold text-sm text-slate-800 dark:text-white truncate block">
                      {log.employeeName || "Unknown Employee"}
                    </span>
                    {/* Check-in Timestamp */}
                    <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1">
                       <Clock className="w-3 h-3" /> {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(log.timestamp))}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 ${
                    log.punchType === 'CheckIn' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                  }`}>
                    {log.punchType === 'CheckIn' ? 'IN' : 'OUT'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
