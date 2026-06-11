'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Save, Loader2, Users, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface PermissionMatrix {
  [module: string]: {
    canRead: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

const MODULES = ['Emails', 'Users', 'Attendance', 'Teams', 'Leaves', 'Payroll'];

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  // Matrix State
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [saving, setSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  // Fetch Roles
  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/settings/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (err) {
      console.error(err);
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
      if (roleObj && roleObj.permissions) {
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
      toast.error('Please enter a name for the new role.');
      return;
    }
    if (!isCreatingNew && !selectedRole) {
      toast.error('Please select a role or create a new one.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: isCreatingNew ? undefined : selectedRole,
        name: isCreatingNew ? newRoleName : roles.find(r => r.id === selectedRole)?.name,
        matrix
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Shield className="w-6 h-6 text-purple-500" />
            </div>
            Roles & Permissions
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Configure granular scope-level access control for roles.
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
          <label className="text-sm font-bold text-slate-700 dark:text-white block">Select Role to Edit</label>
          <div className="flex gap-3">
            {!isCreatingNew ? (
              <>
                <select
                  value={selectedRole || ''}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full max-w-sm px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                >
                  <option value="">— Select Role —</option>
                  {roles.map(r => (
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
                  <Plus className="w-4 h-4" /> New Role
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Enter new role name..."
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

        <div className="overflow-x-auto">
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
  );
}
