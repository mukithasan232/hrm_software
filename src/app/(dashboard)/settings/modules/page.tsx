'use client';

import React, { useEffect, useState } from 'react';
import PageGuard from '@/components/auth/PageGuard';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Loader2, Settings2 } from 'lucide-react';

export default function ModulesSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/settings/modules');
      setConfig(res.data);
    } catch (error) {
      toast.error('Failed to load module configuration');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (field: string, currentValue: boolean) => {
    try {
      setSaving(true);
      const res = await api.patch('/settings/modules', {
        [field]: !currentValue,
      });
      setConfig(res.data.config);
      toast.success('Module settings updated successfully');
      // Force a full reload to refresh sidebar and context globally if needed
      window.location.reload();
    } catch (error) {
      toast.error('Failed to update module configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <PageGuard moduleName="Settings">
      <div className="max-w-4xl mx-auto space-y-6 animate-enter">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Module Configuration</h1>
            <p className="text-slate-500 text-sm">Enable or disable core system modules across the entire application.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Task Module */}
            <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">Task Management Module</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400">Enable creating, assigning, and tracking tasks.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config?.isTaskModuleEnabled ?? true}
                  disabled={saving}
                  onChange={() => toggleModule('isTaskModuleEnabled', config?.isTaskModuleEnabled ?? true)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Leave Module */}
            <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">Leave Management Module</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400">Enable leave applications, approvals, and balances.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config?.isLeaveModuleEnabled ?? true}
                  disabled={saving}
                  onChange={() => toggleModule('isLeaveModuleEnabled', config?.isLeaveModuleEnabled ?? true)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Attendance Module */}
            <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">Attendance Module</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400">Enable check-in/out and timesheet tracking.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config?.isAttendanceEnabled ?? true}
                  disabled={saving}
                  onChange={() => toggleModule('isAttendanceEnabled', config?.isAttendanceEnabled ?? true)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
