"use client";

import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { LogOut, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface CheckedOutEmployee {
  id: string;
  name: string;
  avatar: string | null;
  designation: string;
  checkOutTime: string;
}

export default function CheckedOutWidget() {
  const [checkedOutEmployees, setCheckedOutEmployees] = useState<CheckedOutEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCheckedOutToday = async () => {
      try {
        const res = await api.get('/dashboard/checked-out-today');
        if (res.data?.success) {
          setCheckedOutEmployees(res.data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch checked out employees:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCheckedOutToday();
  }, []);

  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-center h-48">
        <p className="text-slate-400 text-sm animate-pulse">Loading checkout data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/10 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 rounded-lg">
          <LogOut className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Checked Out Today ({checkedOutEmployees.length})</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {checkedOutEmployees.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70 mt-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Shift Active</p>
            <p className="text-xs text-slate-500">No employees have checked out yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {checkedOutEmployees.map((emp) => (
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
                    <p className="text-xs text-slate-500 capitalize">{emp.designation}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold whitespace-nowrap">
                  Out: {format(new Date(emp.checkOutTime), 'hh:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
