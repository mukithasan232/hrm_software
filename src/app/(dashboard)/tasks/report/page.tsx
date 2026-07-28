'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import Cookies from 'js-cookie';
import PageGuard from '@/components/auth/PageGuard';
import TaskNav from '@/components/tasks/TaskNav';

export default function TaskReportPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdminUser = ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'].includes(
    (user as any)?.designation || ''
  );

  const [analyticsData, setAnalyticsData] = useState<{count: number, tasks: any[]}>({ count: 0, tasks: [] });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsStart, setAnalyticsStart] = useState(new Date().toISOString().slice(0, 10));
  const [analyticsEnd, setAnalyticsEnd] = useState(new Date().toISOString().slice(0, 10));

  const fetchAnalytics = useCallback(async () => {
    if (typeof window !== 'undefined' && !Cookies.get('token')) return;
    try {
      setAnalyticsLoading(true);
      let url = '/tasks/analytics';
      if (isAdminUser) {
        url += `?startDate=${analyticsStart}&endDate=${analyticsEnd}`;
      }
      const res = await api.get(url);
      setAnalyticsData(res.data);
    } catch (e: any) {
      console.warn('Failed to load task analytics:', e?.response?.data?.message || e.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [isAdminUser, analyticsStart, analyticsEnd]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchAnalytics();
  }, [fetchAnalytics, authLoading, user]);

  return (
    <PageGuard moduleName="Tasks">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Task Reports</h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm font-medium">Analytics and completion metrics</p>
        
        <TaskNav />

        {!isAdminUser ? (
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between max-w-md">
            <div>
              <p className="text-indigo-100 text-sm font-semibold mb-1">Tasks Completed Today</p>
              <h2 className="text-3xl font-bold">{analyticsLoading ? '...' : analyticsData.count}</h2>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Task Completion Report
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">Total Tasks Completed in Selected Period: <span className="font-bold text-slate-900 dark:text-white">{analyticsLoading ? '...' : analyticsData.count}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="date" 
                  value={analyticsStart} 
                  onChange={(e) => setAnalyticsStart(e.target.value)}
                  className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input 
                  type="date" 
                  value={analyticsEnd} 
                  onChange={(e) => setAnalyticsEnd(e.target.value)}
                  className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                />
                <button 
                  onClick={fetchAnalytics}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  Filter
                </button>
              </div>
            </div>

            {analyticsData.tasks.length > 0 && (
              <div className="overflow-x-auto border border-slate-100 dark:border-white/5 rounded-xl mt-4">
                <div className="w-full overflow-x-auto rounded-lg shadow-sm">
<table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                  <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Task Title</th>
                      <th className="px-4 py-3 font-semibold">Completed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {analyticsData.tasks.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{t.assignedTo?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{t.title}</td>
                        <td className="px-4 py-3 text-slate-500">{new Date(t.completedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageGuard>
  );
}
