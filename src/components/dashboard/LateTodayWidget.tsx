"use client";

import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { Clock, AlertCircle } from 'lucide-react';

interface LateEmployee {
  id: string;
  name: string;
  avatar: string | null;
  designation: string;
  lateMinutes: number;
}

export default function LateTodayWidget() {
  const [lateEmployees, setLateEmployees] = useState<LateEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLateToday = async () => {
      try {
        const res = await api.get('/dashboard/late-today');
        if (res.data?.success) {
          const allLate = res.data.data || [];
          setLateEmployees(allLate.filter((emp: any) => emp.lateMinutes && emp.lateMinutes > 0));
        }
      } catch (error) {
        console.error("Failed to fetch late employees:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLateToday();
  }, []);

  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-center h-48">
        <p className="text-slate-400 text-sm animate-pulse">Loading late data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/10 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 rounded-lg">
          <Clock className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Late Today</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {lateEmployees.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70 mt-4">
            <AlertCircle className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Great news!</p>
            <p className="text-xs text-slate-500">No one was late today.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lateEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                <div className="flex items-center gap-3">
                  {emp.avatar ? (
                    <img src={`${BACKEND}${emp.avatar}`} alt={emp.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{emp.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{emp?.designation?.name || emp?.designation || 'N/A'}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold whitespace-nowrap">
                  {emp.lateMinutes >= 60 
                    ? `${Math.floor(emp.lateMinutes / 60)}h ${emp.lateMinutes % 60}m late`
                    : `${emp.lateMinutes}m late`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
