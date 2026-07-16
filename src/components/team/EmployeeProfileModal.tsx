'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Briefcase, Clock, CalendarDays, CheckCircle2, MapPin, X, RefreshCw } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import api from '@/services/api';
import Link from 'next/link';

interface EmployeeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
}

const BD_TZ = 'Asia/Dhaka';

export default function EmployeeProfileModal({ isOpen, onClose, employeeId }: EmployeeProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchProfile();
    } else {
      setData(null);
    }
  }, [isOpen, employeeId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/employees/${employeeId}/profile`);
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch profile', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-white/10">
        
        {/* Header Actions */}
        <div className="flex justify-end p-4 absolute top-0 right-0 z-10 w-full">
          <button 
            onClick={onClose} 
            className="p-2 bg-white/50 dark:bg-black/50 hover:bg-white dark:hover:bg-slate-800 rounded-full backdrop-blur-md transition-colors text-slate-500 hover:text-red-500 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !data ? (
          <div className="flex flex-col items-center justify-center h-[500px]">
            <RefreshCw className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-slate-500 font-medium">Loading profile...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
            
            {/* Top Profile Card */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
              <div className="relative shrink-0">
                {data.employee.profileImage || data.employee.avatar ? (
                  <img src={data.employee.profileImage || data.employee.avatar} alt={data.employee.name} className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-indigo-50 dark:border-indigo-500/20 shadow-md" />
                ) : (
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-4xl md:text-5xl font-bold shadow-md">
                    {data.employee.name.charAt(0)}
                  </div>
                )}
                <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 ${data.employee.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} title={data.employee.isActive ? 'Active' : 'Inactive'} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-4xl font-bold text-slate-800 dark:text-white truncate">{data.employee.name}</h1>
                <p className="text-indigo-600 dark:text-indigo-400 font-medium text-lg mt-1 truncate">
                  {data.employee.customDesignation?.name || 'Unassigned'}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><Mail className="w-4 h-4"/> {data.employee.email}</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4"/> {data.employee.customDepartment?.name || data.employee.department || 'Unassigned'}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4"/> {data.employee.employeeType || 'IN_HOUSE'}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> Shift: {data.employee.shift?.startTime || data.employee.shiftStartTime || data.employee.customDepartment?.shiftStartTime || '09:00'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0 hidden md:flex">
                <div className="px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Employee ID</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white font-mono">{data.employee.employeeId}</p>
                </div>
              </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Attendance Timeline */}
              <div className="lg:col-span-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm h-[400px] flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <CalendarDays className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Recent Attendance</h2>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {data.recentDates.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No recent attendance found.</p>
                  ) : (
                    data.recentDates.map((date: string) => {
                      const logs = data.logsByDate[date];
                      return (
                        <div key={date} className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 relative overflow-hidden group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatInTimeZone(new Date(date), BD_TZ, 'MMM dd, yyyy')}</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Present</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In: {logs.checkIn ? formatInTimeZone(new Date(logs.checkIn), BD_TZ, 'hh:mm a') : '--:--'}</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Out: {logs.checkOut ? formatInTimeZone(new Date(logs.checkOut), BD_TZ, 'hh:mm a') : '--:--'}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-white/5 mt-2">
                  <Link href={`/attendance`} onClick={onClose} className="block w-full text-center py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
                    View Full Report
                  </Link>
                </div>
              </div>

              {/* Tasks List */}
              <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Active Tasks ({data.employee.assignedTasks?.length || 0})</h2>
                  </div>
                  <Link href={`/tasks`} onClick={onClose} className="text-sm font-semibold text-indigo-500 hover:text-indigo-600 transition-colors">
                    View All Tasks →
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {(!data.employee.assignedTasks || data.employee.assignedTasks.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-50">
                      <CheckCircle2 className="w-10 h-10 text-slate-400 mb-2" />
                      <p className="text-sm text-slate-500">No active tasks assigned.</p>
                    </div>
                  ) : (
                    data.employee.assignedTasks.map((task: any) => (
                      <Link key={task.id} href={`/tasks?id=${task.id}`} onClick={onClose} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors group">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.title}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{task.description || 'No description provided'}</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                            task.priority === 'HIGH' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 
                            task.priority === 'MEDIUM' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' : 
                            'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {task.priority}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                            task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 
                            'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
