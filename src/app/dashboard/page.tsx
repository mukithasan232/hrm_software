'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, CalendarRange, RefreshCw, Clock } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useTranslation } from '@/context/LanguageContext';

export default function DashboardOverview() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    employees: 0,
    pendingLeaves: 0,
    activeNow: 0,
    totalToday: 0
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [usersRes, leavesRes, presenceRes] = await Promise.all([
        api.get('/users'),
        api.get('/leaves/all'),
        api.get('/attendance/active-today')
      ]);

      setStats({
        employees: usersRes.data.totalCount || usersRes.data.data?.length || usersRes.data.length || 0,
        pendingLeaves: leavesRes.data.filter((l: any) => l.status === 'Pending').length || 0,
        activeNow: presenceRes.data.activeNow || 0,
        totalToday: presenceRes.data.totalToday || 0
      });
      setRecentAttendance(presenceRes.data.recent || []);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const pollLiveActivity = async () => {
    try {
      const res = await api.get(`/attendance/active-today?_t=${Date.now()}`);
      setStats(prev => ({
        ...prev,
        activeNow: res.data.activeNow || 0,
        totalToday: res.data.totalToday || 0
      }));
      setRecentAttendance(res.data.recent || []);
    } catch (e) {
      console.error('Live polling failed:', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Robust 5-second polling to fetch latest active presence strictly from the DB
      const intervalId = setInterval(() => {
        pollLiveActivity();
      }, 5000);

      return () => clearInterval(intervalId);
    }
  }, [user]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.post('/attendance/sync-users');
      toast.success('Device sync complete!');
    } catch (e: any) {
      console.warn('Device sync skipped/failed:', e.message);
    }
    await pollLiveActivity();
    toast.success('Latest data loaded from database!');
    setSyncing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="py-2">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            Welcome, {user?.name || 'Super Admin'}
          </h1>
        </div>
        <button 
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 font-medium shadow-md shadow-indigo-500/10"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">{t('presentNow')}</p>
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
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">{t('totalEmployees')}</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{loading ? '-' : stats.employees}</p>
          </div>
          <div className="p-4 bg-blue-500/20 rounded-xl text-blue-500 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all shadow-sm dark:shadow-md">
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">{t('pendingLeaves')}</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{loading ? '-' : stats.pendingLeaves}</p>
          </div>
          <div className="p-4 bg-purple-500/20 rounded-xl text-purple-500 dark:text-purple-400">
            <CalendarRange className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="max-w-4xl mx-auto w-full">
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-md dark:shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {t('liveActivity')}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg">{t('realTime')}</span>
          </div>

          <div className="space-y-4 flex-1">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse">
                    <div className="flex flex-col gap-2 w-[70%]">
                      <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-3 w-32 bg-slate-300 dark:bg-slate-600 rounded"></div>
                      <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                  </div>
                ))}
              </div>
            ) : recentAttendance.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 gap-2 opacity-50">
                <Clock className="w-8 h-8" />
                <p className="text-sm italic">{t('waitingForPunches')}</p>
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
                      <Clock className="w-3 h-3" /> {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }).format(new Date(log.timestamp))}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 ${log.punchType === 'CheckIn'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                    }`}>
                    {log.punchType === 'CheckIn' ? t('checkin') : t('checkout')}
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
