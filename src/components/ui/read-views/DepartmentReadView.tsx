import React from 'react';
import { Clock, Coffee, Users, Building2, CalendarRange } from 'lucide-react';

export default function DepartmentReadView({ id, initialData }: { id: string | number | null, initialData: any }) {
  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-sm text-slate-500 animate-pulse">Fetching department data...</p>
      </div>
    );
  }

  const dept = initialData;
  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
            <Building2 className="w-5 h-5 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            {dept.name}
          </h2>
        </div>
        {dept.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {dept.description}
          </p>
        )}
      </div>

      {/* Shift & Break Configuration */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-indigo-500" />
          Timing Configuration
        </h3>

        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Shift Start Time
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{dept.shiftStartTime || 'Not Configured'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Shift End Time
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{dept.shiftEndTime || 'Not Configured'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" /> Lunch Break Start
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{dept.lunchStartTime || 'Not Configured'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" /> Lunch Break End
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{dept.lunchEndTime || 'Not Configured'}</p>
          </div>
        </div>
      </div>

      {/* Employees List */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Assigned Employees
          </h3>
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {dept.employees?.length || 0} Members
          </span>
        </div>

        {dept.employees && dept.employees.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dept.employees.map((emp: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                {emp.profileImage ? (
                  <img
                    src={`${BACKEND}${emp.profileImage}`}
                    alt={emp.name}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{emp.name}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {emp.designation?.name || 'No Designation'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-white/5 border-dashed">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No employees assigned to this department.</p>
          </div>
        )}
      </div>
    </div>
  );
}
