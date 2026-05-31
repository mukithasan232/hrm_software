'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Pencil, Trash2, X, Save, Loader2,
  Users, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ─── Permission Matrix Definition ────────────────────────────────────────────

const PERMISSION_MODULES = [
  {
    category: 'Attendance',
    key: 'attendance',
    permissions: ['view', 'edit', 'export'],
  },
  {
    category: 'Leaves',
    key: 'leaves',
    permissions: ['view', 'create', 'approve', 'delete'],
  },
  {
    category: 'Payroll',
    key: 'payroll',
    permissions: ['view', 'create', 'edit', 'export'],
  },
  {
    category: 'Performance',
    key: 'performance',
    permissions: ['view', 'create', 'edit', 'delete'],
  },
  {
    category: 'Employees',
    key: 'employees',
    permissions: ['view', 'create', 'edit', 'delete'],
  },
  {
    category: 'Reports',
    key: 'reports',
    permissions: ['view', 'export'],
  },
  {
    category: 'Settings',
    key: 'settings',
    permissions: ['view', 'edit'],
  },
  {
    category: 'Team',
    key: 'team',
    permissions: ['view', 'create', 'edit', 'delete'],
  },
];

const PERMISSION_LABEL: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  export: 'Export',
};

type PermissionsMap = Record<string, boolean>;

function buildEmptyPermissions(): PermissionsMap {
  const map: PermissionsMap = {};
  for (const mod of PERMISSION_MODULES) {
    for (const perm of mod.permissions) {
      map[`${mod.key}.${perm}`] = false;
    }
  }
  return map;
}

function countActivePermissions(perms: PermissionsMap): number {
  return Object.values(perms).filter(Boolean).length;
}

// ─── Pill badge for permission count ─────────────────────────────────────────
function PermPill({ count }: { count: number }) {
  if (count === 0) return <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-600 border border-slate-200 dark:border-white/10">None</span>;
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-500 border border-indigo-500/25">
      {count} permission{count !== 1 ? 's' : ''}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DesignationsPage() {
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [designationName, setDesignationName] = useState('');
  const [designationDesc, setDesignationDesc] = useState('');
  const [permissions, setPermissions] = useState<PermissionsMap>(buildEmptyPermissions());
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Accordion state per module row ──
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const toggleRow = (key: string) => setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));

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
    setExpandedRows({});
    setShowModal(true);
  };

  const openEdit = (designation: any) => {
    setEditTarget(designation);
    setDesignationName(designation.name);
    setDesignationDesc(designation.description || '');
    const base = buildEmptyPermissions();
    const merged = { ...base, ...(designation.permissions || {}) };
    setPermissions(merged);
    setExpandedRows({});
    setShowModal(true);
  };

  // ── Toggle a single permission ──
  const togglePerm = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Toggle all permissions in a module ──
  const toggleModule = (modKey: string, modPerms: string[], allOn: boolean) => {
    const update: PermissionsMap = {};
    for (const p of modPerms) {
      update[`${modKey}.${p}`] = !allOn;
    }
    setPermissions(prev => ({ ...prev, ...update } as PermissionsMap));
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
      const payload = { name: designationName.trim(), description: designationDesc.trim(), permissions };
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

  const filtered = designations.filter(r =>
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
            Designations & Permissions
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
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {/* ── Table ── */}
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
                <div className="h-5 w-20 bg-slate-100 dark:bg-white/10 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Shield className="w-12 h-12 mx-auto text-slate-300 dark:text-gray-700 mb-3" />
            <p className="text-slate-400 dark:text-gray-500 font-medium">No designations found</p>
            {!search && (
              <button onClick={openCreate} className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all">
                Create First Designation
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-white/10 text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-gray-600">
              <span>Designation</span>
              <span>Permissions</span>
              <span>Users</span>
              <span>Created</span>
              <span className="w-20 text-right">Actions</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map(designation => {
                const permCount = countActivePermissions(designation.permissions || {});
                return (
                  <div
                    key={designation.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Designation name + description */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white text-sm">{designation.name}</p>
                          {designation.description && (
                            <p className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[200px]">{designation.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Permission count */}
                    <div><PermPill count={permCount} /></div>

                    {/* User count */}
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-gray-400">
                      <Users className="w-3.5 h-3.5 text-slate-400 dark:text-gray-600" />
                      <span className="font-medium">{designation._count?.users ?? 0}</span>
                    </div>

                    {/* Created date */}
                    <div className="text-xs text-slate-400 dark:text-gray-600">
                      {new Date(designation.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>

                    {/* Actions */}
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
          </>
        )}
      </div>

      {/* ════════════════════════ CREATE / EDIT MODAL ════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col z-10">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editTarget ? 'Edit Designation' : 'Create New Designation'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                  Configure the designation name and its module permissions below.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

                {/* Name + Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Designation Name *</label>
                    <input
                      type="text"
                      required
                      value={designationName}
                      onChange={e => setDesignationName(e.target.value)}
                      placeholder="e.g. HR Manager"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Description</label>
                    <input
                      type="text"
                      value={designationDesc}
                      onChange={e => setDesignationDesc(e.target.value)}
                      placeholder="Optional description…"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                {/* Permission Matrix */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-white">Permission Matrix</h3>
                    <span className="text-xs text-slate-400 dark:text-gray-600">
                      {countActivePermissions(permissions)} active
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                    {/* Matrix column headers */}
                    <div className="bg-slate-50 dark:bg-white/[0.03] grid grid-cols-[140px_1fr] border-b border-slate-200 dark:border-white/10">
                      <div className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">Module</div>
                      <div className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">Permissions</div>
                    </div>

                    {/* Module rows */}
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {PERMISSION_MODULES.map(mod => {
                        const allOn = mod.permissions.every(p => permissions[`${mod.key}.${p}`]);
                        const someOn = mod.permissions.some(p => permissions[`${mod.key}.${p}`]);
                        const isExpanded = expandedRows[mod.key] !== false; // default expanded

                        return (
                          <div key={mod.key}>
                            <div className="grid grid-cols-[140px_1fr] items-center hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                              {/* Module name + select-all */}
                              <div className="px-4 py-3 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={allOn}
                                  ref={el => { if (el) el.indeterminate = !allOn && someOn; }}
                                  onChange={() => toggleModule(mod.key, mod.permissions, allOn)}
                                  className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleRow(mod.key)}
                                  className="text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-indigo-500 transition-colors flex items-center gap-1"
                                >
                                  {mod.category}
                                  {isExpanded ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
                                </button>
                              </div>

                              {/* Permission checkboxes */}
                              <div className="px-4 py-3 flex flex-wrap gap-3">
                                {mod.permissions.map(perm => {
                                  const key = `${mod.key}.${perm}`;
                                  const checked = !!permissions[key];
                                  return (
                                    <label
                                      key={perm}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition-all text-xs font-medium select-none ${
                                        checked
                                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-500 hover:border-indigo-500/30 hover:text-indigo-500'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => togglePerm(key)}
                                        className="w-3 h-3 accent-indigo-500"
                                      />
                                      {PERMISSION_LABEL[perm] || perm}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
