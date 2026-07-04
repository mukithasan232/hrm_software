'use client';
import { useTranslation } from '@/context/LanguageContext';
import { Clock, Calendar, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toBDDisplay } from '@/lib/dateUtils';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useState } from 'react';

interface AttendanceReadViewProps {
  id: string | number;
  initialData?: any;
}

export default function AttendanceReadView({ id, initialData }: AttendanceReadViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  
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
    systemCalculatedOtMinutes,
    otBadge,
    isMissingOut,
    status,
    punchTimeline
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

  const handleOtAction = async (actionStatus: 'APPROVED' | 'REJECTED') => {
    try {
      const targetUserId = employeeId; 
      const targetDate = date;

      if (!targetUserId || !targetDate) {
        toast.error("Error: Missing User ID or Date.");
        return;
      }

      // 🚀 NEW: Point to the new bulk update route
      await axios.patch('/api/attendance/ot-status', {
        userId: targetUserId,
        date: targetDate,
        otStatus: actionStatus
      });
      
      toast.success(`Overtime ${actionStatus.toLowerCase()} successfully!`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update Overtime");
    }
  };

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
                {toBDDisplay(checkInRaw, 'hh:mm a')}
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
                {toBDDisplay(checkOutRaw, 'hh:mm a')}
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
          
          <div className={`p-4 rounded-xl border ${
            otBadge === 'Approved' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700/50' : 
            otBadge === 'Rejected' ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-700/50' :
            systemCalculatedOtMinutes > 0 ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-700/50' :
            'bg-slate-50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-sm font-medium ${
                otBadge === 'Approved' ? 'text-emerald-600 dark:text-emerald-400' :
                otBadge === 'Rejected' ? 'text-red-500' :
                systemCalculatedOtMinutes > 0 ? 'text-amber-600 dark:text-amber-400' :
                'text-slate-500'
              }`}>
                Overtime {otBadge !== 'None' && `(${otBadge})`}
              </p>
            </div>
            <p className={`text-2xl font-bold ${
              otBadge === 'Approved' ? 'text-emerald-700 dark:text-emerald-300' :
              otBadge === 'Rejected' ? 'text-red-600 dark:text-red-400' :
              systemCalculatedOtMinutes > 0 ? 'text-amber-700 dark:text-amber-300' :
              'text-slate-900 dark:text-white'
            }`}>
              {otBadge === 'Approved' ? formatMinutes(overtimeMinutes) : formatMinutes(systemCalculatedOtMinutes || 0)}
            </p>
            
            {/* Dynamic Badges and Action Buttons */}
            {otBadge === 'Pending' && systemCalculatedOtMinutes > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                 <button onClick={() => handleOtAction('APPROVED')} className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md hover:bg-emerald-200 transition">
                   ✅ Approve
                 </button>
                 <button onClick={() => handleOtAction('REJECTED')} className="text-[11px] font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-md hover:bg-red-200 transition">
                   ❌ Reject
                 </button>
              </div>
            )}
            {otBadge === 'Approved' && <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block w-max mt-2 border border-emerald-100">✓ Approved</span>}
            {otBadge === 'Rejected' && <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded inline-block w-max mt-2 border border-red-100">✗ Rejected</span>}
          </div>
        </div>

        {/* Place this BELOW the Time Summary Cards */}
        {punchTimeline && punchTimeline.length > 1 && (
          <div className="mt-6 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                View Shift Details ({punchTimeline.length} Sessions)
              </span>
              {showDetails ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            
            {showDetails && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                {punchTimeline.map((session: any, index: number) => (
                  <div key={session.id} className="flex justify-between items-center text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium mb-1">Session {index + 1}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {toBDDisplay(new Date(session.timestamp), 'hh:mm a')} 
                        {' - '} 
                        {session.checkOut ? toBDDisplay(new Date(session.checkOut), 'hh:mm a') : 'Working...'}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-center text-slate-400 mt-2 italic">
                  * Break times between sessions are automatically excluded from valid hours.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
