'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, CalendarRange, RefreshCw, Clock, Megaphone, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useTranslation } from '@/context/LanguageContext';
import { toBDDisplay, getBDToday } from '@/lib/dateUtils';

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
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getBDToday());

  const fetchDashboardData = async () => {
    try {
      const [usersRes, leavesRes, presenceRes, announcementsRes, analyticsRes] = await Promise.all([
        api.get('/users'),
        api.get('/leaves/all'),
        api.get(`/attendance/active-today?date=${selectedDate}`),
        api.get('/announcements').catch(() => ({ data: [] })),
        api.get('/dashboard/analytics').catch(() => ({ data: [] }))
      ]);

      setAnnouncements(announcementsRes.data || []);
      setWeeklyAnalytics(analyticsRes.data || []);

      const allUsers = usersRes.data.data || usersRes.data || [];
      const deptCounts = allUsers.reduce((acc: any, user: any) => {
        if (!user.isActive || user.employeeId === 'UNMAPPED_FALLBACK') return acc;
        const dept = user.department || 'Unassigned';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {});
      setDepartmentData(Object.keys(deptCounts).map(key => ({ name: key, value: deptCounts[key] })));

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
      const res = await api.get(`/attendance/active-today?date=${selectedDate}&_t=${Date.now()}`);
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

      // Robust 3-second polling to fetch latest active presence strictly from the DB
      const intervalId = setInterval(() => {
        pollLiveActivity();
      }, 3000);

      return () => clearInterval(intervalId);
    }
  }, [user, selectedDate]);

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

  const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#6366f1'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="py-2">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            Welcome, {user?.name || 'Super Admin'}
          </h1>
        </div>
        <button 
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 font-medium shadow-md shadow-indigo-500/10 w-full md:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync Data
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notice Board */}
      {announcements.length > 0 && (
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/20 rounded-3xl p-6 shadow-md dark:shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Notice Board</h3>
          </div>
          
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {announcements.map((notice) => {
              const isNew = (new Date().getTime() - new Date(notice.createdAt).getTime()) < 24 * 60 * 60 * 1000;
              return (
                <div key={notice.id} className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 relative">
                  {isNew && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">
                      NEW
                    </span>
                  )}
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm md:text-base">{notice.title}</h4>
                  <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm mt-1 whitespace-pre-wrap">{notice.message}</p>
                  <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>By {notice.author?.name || 'Admin'}</span>
                    <span>{toBDDisplay(notice.createdAt, 'MMM dd, hh:mm a')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Activity Feed */}
      <div className="w-full">
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {t('liveActivity')}
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 w-full sm:w-auto">
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || getBDToday())}
                  className="bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none cursor-pointer font-medium w-full sm:w-32"
                  title="Select date to view punches"
                />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-bold px-2 py-1.5 bg-emerald-500/10 rounded-lg w-full sm:w-auto text-center">{selectedDate === getBDToday() ? t('realTime') : 'Historical'}</span>
            </div>
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
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                        {log.employeeName || "Unknown Employee"}
                      </span>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0"></span>
                    </div>
                    {/* Check-in Timestamp */}
                    <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> {toBDDisplay(log.timestamp, 'hh:mm a')}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Checked In - Pending Check Out
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Analytics */}
      <div className="lg:col-span-1 space-y-6">
        {/* Weekly Attendance Chart */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-primary/20 rounded-lg text-brand-primary">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Weekly Attendance</h3>
          </div>
          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
              </div>
            ) : weeklyAnalytics.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyAnalytics} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.2} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="absent" name="Absent" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
              <PieChartIcon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Department Overview</h3>
          </div>
          <div className="h-64 w-full relative">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : departmentData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {!loading && departmentData.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none pb-4">
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{stats.employees}</span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Total</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      </div>
    </div>
  );
}
