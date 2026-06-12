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
  { label: 'Emails',      key: 'Emails' },
  { label: 'Attendance',  key: 'Attendance' },
  { label: 'Leaves',      key: 'Leaves' },
  { label: 'Employees',   key: 'Employees' },
  { label: 'Payroll',     key: 'Payroll' },
  { label: 'Performance', key: 'Performance' },
  { label: 'Teams',       key: 'Teams' },
  { label: 'Reports',     key: 'Reports' },
  { label: 'Settings',    key: 'Settings' },
] as const;

type ModuleKey = (typeof SCOPE_MODULES)[number]['key'];

// Columns and their allowed option sets
const CRUD_COLS   = ['Create', 'Read', 'Edit', 'Delete'] as const;
const TOGGLE_COLS = ['Access', 'Stream'] as const;
const ALL_COLS    = ['Access', 'Create', 'Read', 'Edit', 'Delete', 'Stream'] as const;

type ColKey = (typeof ALL_COLS)[number];

const CRUD_OPTIONS   = ['no', 'own', 'department', 'all'] as const;
const TOGGLE_OPTIONS = ['not-set', 'enabled'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ModulePerms = {
  Access: string;
  Create: string;
  Read: string;
  Edit: string;
  Delete: string;
  Stream: string;
};

type PermissionsMap = Record<ModuleKey, ModulePerms>;

function buildEmptyPermissions(): PermissionsMap {
  const map = {} as PermissionsMap;
  for (const mod of SCOPE_MODULES) {
    map[mod.key] = {
      Access: 'not-set',
      Create: 'no',
      Read:   'no',
      Edit:   'no',
      Delete: 'no',
      Stream: 'not-set',
    };
  }
  return map;
}

function mergePermissions(saved: any): PermissionsMap {
  const base = buildEmptyPermissions();
  if (!saved || typeof saved !== 'object') return base;
  for (const mod of SCOPE_MODULES) {
    if (saved[mod.key] && typeof saved[mod.key] === 'object') {
      base[mod.key] = { ...base[mod.key], ...saved[mod.key] };
    }
  }
  return base;
}

function countActivePermissions(perms: PermissionsMap): number {
  let count = 0;
  for (const mod of SCOPE_MODULES) {
    const m = perms[mod.key];
    if (!m) continue;
    if (m.Access === 'enabled') count++;
    if (m.Stream === 'enabled') count++;
    if (m.Create !== 'no') count++;
    if (m.Read   !== 'no') count++;
    if (m.Edit   !== 'no') count++;
    if (m.Delete !== 'no') count++;
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
    case 'all':        return 'text-emerald-600 dark:text-emerald-400';
    case 'department': return 'text-blue-600 dark:text-blue-400';
    case 'own':        return 'text-amber-600 dark:text-amber-400';
    case 'enabled':    return 'text-emerald-600 dark:text-emerald-400';
    default:           return 'text-slate-400 dark:text-gray-500';  // no / not-set
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
export default function DesignationsPage() {
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');

  // Modal state
  const [showModal, setShowModal]           = useState(false);
  const [editTarget, setEditTarget]         = useState<any | null>(null);
  const [designationName, setDesignationName] = useState('');
  const [designationDesc, setDesignationDesc] = useState('');
  const [permissions, setPermissions]       = useState<PermissionsMap>(buildEmptyPermissions());
  const [submitting, setSubmitting]         = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Fetch ──
  const fetchDesignations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/team/designations');
      setDesignations(res.data);
    } catch {
      toast.error('Failed to load designations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDesignations(); }, [fetchDesignations]);

  // ── Open modal ──
  const openCreate = () => {
    setEditTarget(null);
    setDesignationName('');
    setDesignationDesc('');
    setPermissions(buildEmptyPermissions());
    setShowModal(true);
  };

  const openEdit = (designation: any) => {
    setEditTarget(designation);
    setDesignationName(designation.name);
    setDesignationDesc(designation.description || '');
    setPermissions(mergePermissions(designation.permissions));
    setShowModal(true);
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
    if (!designationName.trim()) {
      toast.error('Designation name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name:        designationName.trim(),
        description: designationDesc.trim(),
        permissions, // nested structure: { Attendance: { Read: 'department', ... }, ... }
      };
      if (editTarget) {
        await api.put(`/team/designations/${editTarget.id}`, payload);
        toast.success('Designation updated successfully!');
      } else {
        await api.post('/team/designations', payload);
        toast.success('Designation created successfully!');
      }
      setShowModal(false);
      fetchDesignations();
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
      await api.delete(`/team/designations/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetchDesignations();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete designation');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = designations.filter(
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
            Designations &amp; Permissions
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Define custom designations with granular module-level permissions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all w-fit"
        >
          <Plus className="w-4 h-4" /> Create Designation
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search designations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {/* ── Designations Table ── */}
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
            <p className="text-slate-400 dark:text-gray-500 font-medium">No designations found</p>
            {!search && (
              <button
                onClick={openCreate}
                className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Create First Designation
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-white/10 text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-gray-600">
                <span>Designation</span>
                <span>Permissions</span>
                <span>Users</span>
                <span>Created</span>
                <span className="w-20 text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((designation) => {
                  const permCount = countActivePermissions(
                    mergePermissions(designation.permissions)
                  );
                  return (
                    <div
                      key={designation.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-white text-sm">{designation.name}</p>
                            {designation.description && (
                              <p className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[200px]">
                                {designation.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div><PermPill count={permCount} /></div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-gray-400">
                        <Users className="w-3.5 h-3.5 text-slate-400 dark:text-gray-600" />
                        <span className="font-medium">{designation._count?.users ?? 0}</span>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-gray-600">
                        {new Date(designation.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-2 justify-end w-20">
                        <button
                          onClick={() => openEdit(designation)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                          title="Edit Designation"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(designation)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete Designation"
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
              {filtered.map((designation) => {
                const permCount = countActivePermissions(
                  mergePermissions(designation.permissions)
                );
                return (
                  <div key={designation.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{designation.name}</p>
                          {designation.description && (
                            <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{designation.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(designation)}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(designation)}
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
                          <span>{designation._count?.users ?? 0}</span>
                        </div>
                        <span className="text-slate-300 dark:text-gray-700">•</span>
                        <span className="text-slate-400 dark:text-gray-500">
                          {new Date(designation.createdAt).toLocaleDateString('en-GB', {
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
                  {editTarget ? 'Edit Designation' : 'Create New Designation'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                  Set the designation name, then configure the Scope Level permission matrix.
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
                      Designation Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={designationName}
                      onChange={(e) => setDesignationName(e.target.value)}
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
                      value={designationDesc}
                      onChange={(e) => setDesignationDesc(e.target.value)}
                      placeholder="Optional short description…"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                {/* ── Scope Level Matrix ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-white">Scope Level</h3>
                      <p className="text-[11px] text-slate-400 dark:text-gray-600 mt-0.5">
                        Configure granular access scopes per module.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1">
                      {countActivePermissions(permissions)} active
                    </span>
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

                                {/* Stream (toggle) */}
                                <td className="px-4 py-2.5 text-center">
                                  <ScopeSelect
                                    value={rowPerms.Stream}
                                    options={TOGGLE_OPTIONS}
                                    onChange={(v) => setCellValue(mod.key, 'Stream', v)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
                    <span className="text-[11px] text-slate-400 dark:text-gray-600 font-medium">Legend:</span>
                    {[
                      { val: 'no',         label: 'No access' },
                      { val: 'own',        label: 'Own records' },
                      { val: 'department', label: 'Department' },
                      { val: 'all',        label: 'All records' },
                      { val: 'enabled',    label: 'Enabled' },
                      { val: 'not-set',    label: 'Not set' },
                    ].map(({ val, label }) => (
                      <span key={val} className={`text-[11px] font-semibold ${valueBadgeClass(val)}`}>
                        {val} <span className="font-normal text-slate-400 dark:text-gray-600">= {label}</span>
                      </span>
                    ))}
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
                  {submitting ? 'Saving…' : editTarget ? 'Update Designation' : 'Create Designation'}
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
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Delete Designation?</h2>
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
