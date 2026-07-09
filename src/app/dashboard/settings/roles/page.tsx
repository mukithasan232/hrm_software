'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Save, Loader2, Users, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface PermissionMatrix {
  [module: string]: {
    canRead: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

const MODULES = ['Emails', 'Users', 'Attendance', 'Teams', 'Leaves', 'Payroll', 'Tasks'];

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  // Matrix State
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [saving, setSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  
  const [weekendDays, setWeekendDays] = useState<string[]>(['Sunday']);
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Fetch Roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/roles');
      if (res.ok) {
        const data = await res.json();
        // Safe check for the array in case response is wrapped in an object
        const rolesArray = Array.isArray(data) ? data : (data?.data || data?.roles || []);
        setRoles(rolesArray);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Initialize matrix based on selection
  useEffect(() => {
    const initMatrix: PermissionMatrix = {};
    MODULES.forEach(mod => {
      initMatrix[mod] = { canRead: false, canCreate: false, canEdit: false, canDelete: false };
    });

    if (selectedRole) {
      const roleObj = roles.find(r => r.id === selectedRole);
      if (roleObj) {
        if (roleObj.permissions) {
          roleObj.permissions.forEach((p: any) => {
            if (initMatrix[p.moduleName]) {
              initMatrix[p.moduleName] = {
                canRead: p.canRead,
                canCreate: p.canCreate,
                canEdit: p.canEdit,
                canDelete: p.canDelete,
              };
            }
          });
        }
        let parsedWeekends = roleObj.weekendDays;
        if (typeof parsedWeekends === 'string') {
          try { parsedWeekends = JSON.parse(parsedWeekends); } catch (e) {}
        }
        setWeekendDays(Array.isArray(parsedWeekends) ? parsedWeekends : ['Sunday']);
      }
    } else {
      setWeekendDays(['Sunday']);
    }
    setMatrix(initMatrix);
  }, [selectedRole, roles]);

  // Handler for dropdowns
  const handlePermChange = (module: string, action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete', val: string) => {
    setMatrix(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: val === 'Yes',
      }
    }));
  };

  const handleSave = async () => {
    if (isCreatingNew && !newRoleName.trim()) {
      toast.error('Please enter a name for the new designation.');
      return;
    }
    if (!isCreatingNew && !selectedRole) {
      toast.error('Please select a designation or create a new one.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: isCreatingNew ? undefined : selectedRole,
        name: isCreatingNew ? newRoleName : roles.find(r => r.id === selectedRole)?.name,
        matrix,
        weekendDays
      };

      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Permissions matrix saved successfully!');
        if (isCreatingNew) {
          setIsCreatingNew(false);
          setNewRoleName('');
        }
        await fetchRoles(); // refresh list
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
      }
    } catch (e) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors mb-2">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Shield className="w-6 h-6 text-purple-500" />
            </div>
            Designation & Permission
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Configure granular scope-level access control for designations.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all w-fit disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Matrix'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden p-6">
        <div className="mb-6 space-y-3">
          <label className="text-sm font-bold text-slate-700 dark:text-white block">Select Designation to Edit</label>
          <div className="flex gap-3">
            {!isCreatingNew ? (
              <>
                <select
                  value={selectedRole || ''}
                  onChange={e => setSelectedRole(e.target.value)}
                  disabled={loading}
                  className="w-full max-w-sm px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all disabled:opacity-50"
                >
                  <option value="" disabled>{loading ? 'Loading designations...' : '— Select Designation —'}</option>
                  {roles && roles.length > 0 && roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(true);
                    setSelectedRole(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> New Designation
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Enter new designation name..."
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  className="w-full max-w-sm px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-brand-primary/50 dark:border-brand-primary/50 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2.5 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white text-sm font-bold transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Weekend Configuration ── */}
        <div className="mb-6">
          <label className="text-sm font-bold text-slate-700 dark:text-white block mb-3">Weekend Configuration</label>
          <button
            type="button"
            onClick={() => setShowWeekendModal(true)}
            className="w-full max-w-sm px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all flex items-center justify-between"
          >
            <span>{weekendDays.length > 0 ? weekendDays.join(', ') : 'No weekends selected'}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold tracking-wide">+ Add Weekend</span>
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Module</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider text-center">Read Access</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider text-center">Create</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider text-center">Edit</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {MODULES.map((mod) => (
                <tr key={mod} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-white text-sm">{mod}</td>
                  
                  {['canRead', 'canCreate', 'canEdit', 'canDelete'].map((action) => (
                    <td key={action} className="py-3 px-4 text-center">
                      <select
                        value={matrix[mod]?.[action as keyof typeof matrix[string]] ? 'Yes' : 'No'}
                        onChange={(e) => handlePermChange(mod, action as any, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none transition-colors border ${
                          matrix[mod]?.[action as keyof typeof matrix[string]]
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ── Weekend Selection Modal ── */}
    {showWeekendModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowWeekendModal(false)} />
        <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col p-6 animate-in zoom-in-95 duration-200">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Select Weekend Days</h3>
          <div className="flex flex-col gap-2 mb-6">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all ${
                  weekendDays.includes(day)
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  checked={weekendDays.includes(day)}
                  onChange={() => {
                    setWeekendDays((prev) =>
                      prev.includes(day)
                        ? prev.filter((d) => d !== day)
                        : [...prev, day]
                    );
                  }}
                />
                <span className="text-sm font-semibold">{day}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowWeekendModal(false)}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    )}
    </>
  );
}
