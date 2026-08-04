"use client";

import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface LateEmployee {
  id: string;
  name: string;
  avatar: string | null;
  designation: any;
  lateMinutes: number;
}

export default function LateTodayWidget({ lateList = [] }: { lateList?: any[] }) {
  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  // Map the raw backend logs (which includes user object) to the expected LateEmployee interface format
  const lateEmployees: LateEmployee[] = lateList.map(log => {
    const shiftStr = log.user?.shift?.startTime || log.user?.shiftStartTime || log.user?.customDepartment?.shiftStartTime;
    let lateMins = 0;
    if (shiftStr) {
      const [hours, minutes] = shiftStr.split(':').map(Number);
      const shiftStartMins = hours * 60 + minutes;
      const checkInDate = new Date(log.timestamp);
      const bdTime = new Date(checkInDate.getTime() + (6 * 60 * 60 * 1000));
      const checkInMins = bdTime.getUTCHours() * 60 + bdTime.getUTCMinutes();
      lateMins = Math.max(0, checkInMins - shiftStartMins);
    }
    
    return {
      id: log.employeeId || log.id,
      name: log.user?.name || log.employeeName || "Unknown",
      avatar: log.user?.profileImage || log.user?.avatar || null,
      designation: log.user?.designation,
      lateMinutes: lateMins
    };
  });

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/10 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 rounded-lg">
          <Clock className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Late Today ({lateEmployees.length})</h3>
      </div>
      
      <div className="flex-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
                  <Avatar 
                    src={emp.avatar} 
                    name={emp.name} 
                    className="w-10 h-10 rounded-full object-cover" 
                    fallbackClassName="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-sm"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{emp.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{emp?.designation?.name || emp?.designation || 'N/A'}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold whitespace-nowrap">
                  Late: {emp.lateMinutes >= 60
                  ? `${Math.floor(emp.lateMinutes / 60)}h ${emp.lateMinutes % 60}m`
                  : `${emp.lateMinutes}m`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
