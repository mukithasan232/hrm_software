'use client';

import React, { useEffect, useState, useRef } from 'react';
import api from '@/services/api';
import { CheckCircle2, Clock, CalendarRange, Activity } from 'lucide-react';
import PageGuard from '@/components/auth/PageGuard';
import { formatDistanceToNow } from 'date-fns';

type StreamItem = {
  id: string;
  type: 'TASK' | 'ATTENDANCE' | 'LEAVE';
  actionContext: string;
  user: { name: string; profileImage: string | null; avatar?: string | null };
  timestamp: string;
  metadata: any;
};

export default function GlobalStreamPage() {
  const [stream, setStream] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const fetchStream = async (silent = false) => {
    if (loadingRef.current) return;
    try {
      if (!silent) setLoading(true);
      loadingRef.current = true;
      const res = await api.get('/global-stream');
      if (res.data) setStream(res.data);
    } catch (err) {
      console.error('Error fetching global stream:', err);
    } finally {
      if (!silent) setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    fetchStream();
    // Poll every 15 seconds
    const intervalId = setInterval(() => fetchStream(true), 15000);
    return () => clearInterval(intervalId);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'TASK':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'ATTENDANCE':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'LEAVE':
        return <CalendarRange className="w-5 h-5 text-orange-500" />;
      default:
        return <Activity className="w-5 h-5 text-slate-500" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'TASK':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30';
      case 'ATTENDANCE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30';
      case 'LEAVE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-500/30';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <PageGuard moduleName="Dashboard">
      <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
              <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Global Stream</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Real-time activity feed across all departments and modules.
          </p>
        </div>

        <div className="space-y-4">
          {loading && stream.length === 0 ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : stream.length === 0 ? (
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-800">
              <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No recent activities found.</p>
            </div>
          ) : (
            <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
              {stream.map((item) => (
                <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-50 dark:bg-slate-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    {getIcon(item.type)}
                  </div>
                  
                  {/* Card */}
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        {item.user?.profileImage || (item.user as any)?.avatar ? (
                          <img
                            src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}${item.user.profileImage || (item.user as any).avatar}`}
                            alt={item.user.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-600"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {item.user?.name ? item.user.name.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
                            {item.user?.name || 'Unknown User'}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${getBadgeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {item.actionContext}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageGuard>
  );
}
