import React from 'react';
import { User, Mail, Building2, Shield, Activity } from 'lucide-react';

export default function UserReadView({ id, initialData }: { id: string | number | null, initialData: any }) {
  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-sm text-slate-500 animate-pulse">Fetching user data...</p>
      </div>
    );
  }

  const user = initialData;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl shadow-md flex-shrink-0">
          {user.name?.charAt(0)?.toUpperCase() || <User className="w-10 h-10" />}
        </div>

        <div className="text-center sm:text-left flex-1 mt-2 sm:mt-0 flex flex-col justify-center h-24">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{user.name}</h2>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-slate-500 dark:text-slate-400 mt-2">
            <Mail className="w-4 h-4" />
            <span className="text-sm font-medium">{user.email}</span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          Account Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> System Role
            </p>
            <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 uppercase tracking-wide">
              {user.role || 'user'}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Account Status
            </p>
            <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border tracking-wide ${user.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'}`}>
              {user.isActive ? 'Active' : 'Suspended'}
            </span>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Assigned Department
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-white/5 inline-block min-w-[200px]">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.department?.name || 'No Department Assigned'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
