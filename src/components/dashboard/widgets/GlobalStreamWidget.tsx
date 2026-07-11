import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock } from 'lucide-react';
import { toBDDisplay } from '@/lib/dateUtils';
import api from '@/services/api';

export const GlobalStreamWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const [stream, setStream] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const res = await api.get('/dashboard/stream');
        if (res.data?.success) {
          setStream(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch stream', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStream();
  }, []);

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col h-full shadow-sm dark:shadow-md overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Global Stream
          </p>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-white/5 rounded-lg w-full" />
              ))}
            </div>
          ) : stream.length > 0 ? (
            <div className="space-y-3">
              {stream.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-start gap-2 border-b border-slate-100 dark:border-white/5 pb-2 last:border-0 last:pb-0">
                  <div className={`p-1.5 rounded-md flex-shrink-0 mt-0.5 ${item.type === 'TASK' ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20'}`}>
                    {item.type === 'TASK' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.user?.name} • {toBDDisplay(item.timestamp, 'hh:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center mt-4">No recent activity</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col h-full shadow-sm dark:shadow-md overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/10 pb-3">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          Global Activity Stream
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : stream.length > 0 ? (
          <div className="space-y-4">
            {stream.map(item => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/10">
                <div className={`p-2 rounded-lg flex-shrink-0 ${item.type === 'TASK' ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20'}`}>
                  {item.type === 'TASK' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{item.title}</p>
                    <span className="text-[10px] font-medium text-slate-400 flex-shrink-0 whitespace-nowrap">
                      {toBDDisplay(item.timestamp, 'MMM dd, hh:mm a')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.user?.avatar ? (
                      <img src={item.user.avatar} alt={item.user.name} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300">
                        {item.user?.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      {item.user?.name || 'Unknown User'}
                      {item.author && ` (Assigned by ${item.author.name})`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <Activity className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No recent activity to show</p>
          </div>
        )}
      </div>
    </div>
  );
};
