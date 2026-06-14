'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Pencil, Trash2, X, Save, Loader2,
  Users, Search, ChevronDown
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ─── Scope / Module definitions ───────────────────────────────────────────────

const SCOPE_MODULES = [
  { label: 'Attendance',      key: 'Attendance' },
  { label: 'Leaves',          key: 'Leaves' },
  { label: 'Announcements',   key: 'Announcements' },
  { label: 'Employees',       key: 'Employees' },
  { label: 'User Management', key: 'User Management' },
  { label: 'System Settings', key: 'System Settings' },
  { label: 'Inbox',           key: 'Inbox' },
] as const;

type ModuleKey = (typeof SCOPE_MODULES)[number]['key'];

// Columns and their allowed option sets
const ALL_COLS    = ['Access', 'Create', 'Read', 'Edit', 'Delete'] as const;

type ColKey = (typeof ALL_COLS)[number];

const CRUD_OPTIONS   = ['No', 'Own', 'Department', 'All'] as const;
const TOGGLE_OPTIONS = ['Not Set', 'Enabled'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ModulePerms = {
  Access: string;
  Create: string;
  Read: string;
  Edit: string;
  Delete: string;
};

type PermissionsMap = Record<ModuleKey, ModulePerms>;

function buildEmptyPermissions(): PermissionsMap {
  const map = {} as PermissionsMap;
  for (const mod of SCOPE_MODULES) {
    map[mod.key] = {
      Access: 'Not Set',
      Create: 'No',
      Read:   'No',
      Edit:   'No',
      Delete: 'No',
    };
  }
  return map;
}

// Normalise legacy lowercase DB values → new capitalised display strings
const VALUE_UPGRADE: Record<string, string> = {
  'no': 'No', 'own': 'Own', 'department': 'Department', 'all': 'All',
  'not-set': 'Not Set', 'enabled': 'Enabled',
};
function normaliseVal(v: any): string {
  if (typeof v !== 'string') return v;
  return VALUE_UPGRADE[v.toLowerCase()] ?? v;
}

function mergePermissions(saved: any): PermissionsMap {
  const base = buildEmptyPermissions();
  if (!saved || typeof saved !== 'object') return base;
  for (const mod of SCOPE_MODULES) {
    if (saved[mod.key] && typeof saved[mod.key] === 'object') {
      const raw = saved[mod.key];
      base[mod.key] = {
        Access: normaliseVal(raw.Access) || base[mod.key].Access,
        Create: normaliseVal(raw.Create) || base[mod.key].Create,
        Read:   normaliseVal(raw.Read)   || base[mod.key].Read,
        Edit:   normaliseVal(raw.Edit)   || base[mod.key].Edit,
        Delete: normaliseVal(raw.Delete) || base[mod.key].Delete,
      };
    }
  }
  return base;
}

function countActivePermissions(perms: PermissionsMap): number {
  let count = 0;
  for (const mod of SCOPE_MODULES) {
    const m = perms[mod.key];
    if (!m) continue;
    if (m.Access === 'Enabled') count++;
    if (m.Create !== 'No') count++;
    if (m.Read   !== 'No') count++;
    if (m.Edit   !== 'No') count++;
    if (m.Delete !== 'No') count++;
  }
  return count;
}

// ─── Pill badge ───────────────────────────────────────────────────────────────
function PermPill({ count }: { count: number }) {
  if (count === 0)
    return (
      <span className="px-3 py-1 rounded-full text-xs bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-600 border border-slate-200 dark:border-white/10">
        None
      </span>
    );
  return (
    <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-full px-3 py-1 text-xs font-medium">
      {count} permission{count !== 1 ? 's' : ''}
    </span>
  );
}

// ─── Scope-Level value badge colour ──────────────────────────────────────────
function valueBadgeClass(val: string): string {
  switch (val) {
    case 'All':        return 'text-emerald-600 dark:text-emerald-400';
    case 'Department': return 'text-blue-600 dark:text-blue-400';
    case 'Own':        return 'text-amber-600 dark:text-amber-400';
    case 'Enabled':    return 'text-emerald-600 dark:text-emerald-400';
    default:           return 'text-slate-400 dark:text-gray-500';  // No / Not Set
  }
}

// ─── Scope-Level Select ───────────────────────────────────────────────────────
function ScopeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (val: string) => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-transparent border-0 pr-5 pl-1 py-1 text-xs font-semibold focus:outline-none focus:ring-0 cursor-pointer ${valueBadgeClass(value)}`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800">
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 w-3 h-3 pointer-events-none text-slate-400" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');

  // Modal state
  const [showModal, setShowModal]           = useState(false);
  const [editTarget, setEditTarget]         = useState<any | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [permissions, setPermissions]       = useState<PermissionsMap>(buildEmptyPermissions());
  const [submitting, setSubmitting]         = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Fetch ──
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/team/roles');
      setRoles(res.data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  // ── Open modal ──
  const openCreate = () => {
    setEditTarget(null);
    setRoleName('');
    setRoleDesc('');
    setPermissions(buildEmptyPermissions());
    setShowModal(true);
  };

  const openEdit = (role: any) => {
    setEditTarget(role);
    setRoleName(role.name);
    setRoleDesc(role.description || '');
    setPermissions(mergePermissions(role.permissions));
    setShowModal(true);
  };

  const handleGrantFullAccess = () => {
    const newPerms: PermissionsMap = {} as PermissionsMap;
    SCOPE_MODULES.forEach(m => {
      newPerms[m.key] = { Access: 'Enabled', Create: 'All', Read: 'All', Edit: 'All', Delete: 'All' };
    });
    setPermissions(newPerms);
  };

  const handleClearAll = () => {
    setPermissions(buildEmptyPermissions());
  };

  // ── Mutate a single cell ──
  const setCellValue = (modKey: ModuleKey, col: ColKey, val: string) => {
    setPermissions((prev) => ({
      ...prev,
      [modKey]: { ...prev[modKey], [col]: val },
    }));
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name:        roleName.trim(),
        description: roleDesc.trim(),
        permissions, // nested structure: { Attendance: { Read: 'department', ... }, ... }
      };
      if (editTarget) {
        await api.put(`/team/roles/${editTarget.id}`, payload);
        toast.success('Role updated successfully!');
      } else {
        await api.post('/team/roles', payload);
        toast.success('Role created successfully!');
      }
      setShowModal(false);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/team/roles/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Shield className="w-6 h-6 text-indigo-500" />
            </div>
            Roles &amp; Permissions
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Define custom roles with granular module-level permissions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all w-fit"
        >
          <Plus className="w-4 h-4" /> Create Role
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search roles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {/* ── Roles Table ── */}
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-slate-100 dark:bg-white/10 rounded" />
                  <div className="h-3 w-48 bg-slate-100 dark:bg-white/10 rounded" />
                </div>
                <div className="h-5 w-24 bg-slate-100 dark:bg-white/10 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Shield className="w-12 h-12 mx-auto text-slate-300 dark:text-gray-700 mb-3" />
            <p className="text-slate-400 dark:text-gray-500 font-medium">No roles found</p>
            {!search && (
              <button
                onClick={openCreate}
                className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Create First Role
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-white/10 text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-gray-600">
                <span>Role</span>
                <span>Permissions</span>
                <span>Users</span>
                <span>Created</span>
                <span className="w-20 text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((role) => {
                  const permCount = countActivePermissions(
                    mergePermissions(role.permissions)
                  );
                  return (
                    <div
                      key={role.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-white text-sm">{role.name}</p>
                            {role.description && (
                              <p className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[200px]">
                                {role.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div><PermPill count={permCount} /></div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-gray-400">
                        <Users className="w-3.5 h-3.5 text-slate-400 dark:text-gray-600" />
                        <span className="font-medium">{role._count?.users ?? 0}</span>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-gray-600">
                        {new Date(role.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-2 justify-end w-20">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                          title="Edit Role"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(role)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete Role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((role) => {
                const permCount = countActivePermissions(
                  mergePermissions(role.permissions)
                );
                return (
                  <div key={role.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{role.name}</p>
                          {role.description && (
                            <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{role.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(role)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 dark:text-gray-500">Permissions:</span>
                        <PermPill count={permCount} />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-gray-400 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{role._count?.users ?? 0}</span>
                        </div>
                        <span className="text-slate-300 dark:text-gray-700">•</span>
                        <span className="text-slate-400 dark:text-gray-500">
                          {new Date(role.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════ CREATE / EDIT MODAL ════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col z-10">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editTarget ? 'Edit Role' : 'Create New Role'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                  Set the role name, then configure the Scope Level permission matrix.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

                {/* Name + Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">
                      Role Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="e.g. HR Manager"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">
                      Description
                    </label>
                    <input
                      type="text"
                      value={roleDesc}
                      onChange={(e) => setRoleDesc(e.target.value)}
                      placeholder="Optional short description…"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                {/* ── Scope Level Matrix ── */}
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        Scope Level
                        <span className="text-xs font-medium text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-0.5 ml-1">
                          {countActivePermissions(permissions)} active
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400 dark:text-gray-600 mt-0.5">
                        Configure granular access scopes per module.
                      </p>
                    </div>
                    
                    {/* Bulk Action Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleGrantFullAccess}
                        className="flex-1 sm:flex-none text-[11px] font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm shadow-indigo-500/20"
                      >
                        Grant Full Access
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="flex-1 sm:flex-none text-[11px] font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-white/10"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 min-w-[130px]">
                              Module
                            </th>
                            {ALL_COLS.map((col) => (
                              <th
                                key={col}
                                className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 min-w-[100px]"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {SCOPE_MODULES.map((mod, idx) => {
                            const rowPerms = permissions[mod.key];
                            return (
                              <tr
                                key={mod.key}
                                className={`border-b border-slate-100 dark:border-white/5 last:border-b-0 transition-colors ${
                                  idx % 2 === 0
                                    ? 'bg-white dark:bg-transparent'
                                    : 'bg-slate-50/60 dark:bg-white/[0.015]'
                                } hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5`}
                              >
                                {/* Module name */}
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                                      {mod.label}
                                    </span>
                                  </div>
                                </td>

                                {/* Access (toggle) */}
                                <td className="px-4 py-2.5 text-center">
                                  <ScopeSelect
                                    value={rowPerms.Access}
                                    options={TOGGLE_OPTIONS}
                                    onChange={(v) => setCellValue(mod.key, 'Access', v)}
                                  />
                                </td>

                                {/* Create */}
                                <td className="px-4 py-2.5 text-center">
                                  <ScopeSelect
                                    value={rowPerms.Create}
                                    options={CRUD_OPTIONS}
                                    onChange={(v) => setCellValue(mod.key, 'Create', v)}
                                  />
                                </td>

                                {/* Read */}
                                <td className="px-4 py-2.5 text-center">
                                  <ScopeSelect
                                    value={rowPerms.Read}
                                    options={CRUD_OPTIONS}
                                    onChange={(v) => setCellValue(mod.key, 'Read', v)}
                                  />
                                </td>

                                {/* Edit */}
                                <td className="px-4 py-2.5 text-center">
                                  <ScopeSelect
                                    value={rowPerms.Edit}
                                    options={CRUD_OPTIONS}
                                    onChange={(v) => setCellValue(mod.key, 'Edit', v)}
                                  />
                                </td>

                                {/* Delete */}
                                <td className="px-4 py-2.5 text-center">
                                  <ScopeSelect
                                    value={rowPerms.Delete}
                                    options={CRUD_OPTIONS}
                                    onChange={(v) => setCellValue(mod.key, 'Delete', v)}
                                  />
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>


                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-400 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {submitting ? 'Saving…' : editTarget ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-red-500/20 rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Delete Role?</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-800 dark:text-white">"{deleteTarget.name}"</span>?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-400 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
