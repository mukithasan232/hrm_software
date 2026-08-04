"use client";

import React from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';

interface EarlyEmployee {
  id: string;
  name: string;
  avatar: string | null;
  designation: any;
  earlyMinutes: number;
}

const calculateEarlyMinutes = (checkInIso: string | Date | null, shiftStartString: string | null) => {
  if (!checkInIso || !shiftStartString) return 0;
  
  try {
    const bdTimeStr = formatInTimeZone(new Date(checkInIso), 'Asia/Dhaka', 'HH:mm');
    const [checkInHours, checkInMinutes] = bdTimeStr.split(':').map(Number);
    const totalCheckInMins = (checkInHours * 60) + checkInMinutes;

    const isPM = shiftStartString.toLowerCase().includes('pm');
    const timeParts = shiftStartString.replace(/am|pm/i, '').trim().split(':');
    let shiftHours = parseInt(timeParts[0], 10);
    const shiftMinutes = parseInt(timeParts[1], 10);

    if (isPM && shiftHours !== 12) shiftHours += 12;
    if (!isPM && shiftHours === 12) shiftHours = 0;

    const totalShiftMins = (shiftHours * 60) + shiftMinutes;

    const diff = totalShiftMins - totalCheckInMins;
    
    return diff > 0 ? diff : 0;
  } catch (error) {
    console.error("Early calculation error:", error);
    return 0;
  }
};

export default function EarlyTodayWidget({ recentList = [] }: { recentList?: any[] }) {
  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  const earlyEmployees: EarlyEmployee[] = recentList.map(log => {
    const shiftStr = log.user?.shift?.startTime || log.user?.shiftStartTime || log.user?.customDepartment?.shiftStartTime || log.shiftStartTime || "10:00 AM";
    const earlyMins = calculateEarlyMinutes(log.timestamp, shiftStr);
    
    return {
      id: log.employeeId || log.id,
      name: log.user?.name || log.employeeName || "Unknown",
      avatar: log.user?.profileImage || log.user?.avatar || null,
      designation: log.user?.designation,
      earlyMinutes: earlyMins
    };
  }).filter(emp => emp.earlyMinutes > 0);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/10 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-green-100 dark:bg-green-500/20 text-green-600 rounded-lg">
          <Clock className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Early Today ({earlyEmployees.length})</h3>
      </div>
      
      <div className="flex-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {earlyEmployees.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70 mt-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No early birds today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {earlyEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                <div className="flex items-center gap-3">
                  {emp.avatar ? (
                    <img src={`${BACKEND}${emp.avatar}`} alt={emp.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{emp.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{emp?.designation?.name || emp?.designation || 'N/A'}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-bold whitespace-nowrap">
                  {emp.earlyMinutes >= 60
                  ? `${Math.floor(emp.earlyMinutes / 60)}h ${emp.earlyMinutes % 60}m early`
                  : `${emp.earlyMinutes}m early`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
