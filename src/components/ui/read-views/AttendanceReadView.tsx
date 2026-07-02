'use client';
import { useTranslation } from '@/context/LanguageContext';
import { Clock, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toBDDisplay } from '@/lib/dateUtils';

interface AttendanceReadViewProps {
  id: string | number;
  initialData?: any;
}

export default function AttendanceReadView({ id, initialData }: AttendanceReadViewProps) {
  const { t } = useTranslation();
  
  if (!initialData) {
    return <div className="text-center p-6 text-slate-500">No attendance data provided.</div>;
  }

  const {
    employeeName,
    employeeId,
    date,
    checkInRaw,
    checkOutRaw,
    totalValidMs,
    lateMinutes,
    overtimeMinutes,
    isMissingOut,
    status
  } = initialData;

  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const totalHours = totalValidMs > 0 ? (totalValidMs / 3600000).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{employeeName}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">ID: {employeeId} • Date: {date}</p>
        <div className="mt-4 px-4 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full text-sm font-semibold text-slate-700 dark:text-slate-300">
          Status: {status === 'Present' ? <span className="text-emerald-600 dark:text-emerald-400">Present</span> : <span className="text-red-500">Absent</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check In</span>
          {checkInRaw ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {toBDDisplay(checkInRaw, 'hh:mm:ss a')}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic font-medium">Missing</span>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check Out</span>
          {checkOutRaw ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {toBDDisplay(checkOutRaw, 'hh:mm:ss a')}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic font-medium">
              {isMissingOut ? 'Missing / Working' : 'Missing'}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Time Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <p className="text-sm font-medium text-slate-500 mb-1">Total Valid Hours</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalValidMs > 0 ? (
                `${Math.floor(totalValidMs / 3600000)}h ${Math.floor((totalValidMs % 3600000) / 60000)}m`
              ) : '0h 0m'}
            </p>
          </div>
          
          <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
            <p className="text-sm font-medium text-red-500 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Late By
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatMinutes(lateMinutes)}
            </p>
          </div>
          
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Overtime</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatMinutes(overtimeMinutes)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
