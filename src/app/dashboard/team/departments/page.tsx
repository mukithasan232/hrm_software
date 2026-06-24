'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Pencil, Trash2, X, Save, Loader2,
  Search
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import PageGuard from '@/components/auth/PageGuard';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentDesc, setDepartmentDesc] = useState('');
  const [casualLeave, setCasualLeave] = useState<number>(10);
  const [sickLeave, setSickLeave] = useState<number>(14);
  const [annualLeave, setAnnualLeave] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/team/departments');
      setDepartments(res.data);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  // ── Open modal ──
  const openCreate = () => {
    setEditTarget(null);
    setDepartmentName('');
    setDepartmentDesc('');
    setCasualLeave(10);
    setSickLeave(14);
    setAnnualLeave(15);
    setShowModal(true);
  };

  const openEdit = (department: any) => {
    setEditTarget(department);
    setDepartmentName(department.name);
    setDepartmentDesc(department.description || '');
    setCasualLeave(department.totalCasualLeaves ?? department.leaveConfig?.casual ?? 10);
    setSickLeave(department.totalSickLeaves ?? department.leaveConfig?.sick ?? 14);
    setAnnualLeave(department.leaveConfig?.annual ?? 15);
    setShowModal(true);
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentName.trim()) {
      toast.error('Department name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { 
        name: departmentName.trim(), 
        description: departmentDesc.trim(),
        leaveConfig: {
          casual: Number(casualLeave) || 0,
          sick: Number(sickLeave) || 0,
          annual: Number(annualLeave) || 0,
        }
      };
      if (editTarget) {
        await api.put(`/team/departments/${editTarget.id}`, payload);
        toast.success('Department updated successfully!');
      } else {
        await api.post('/team/departments', payload);
        toast.success('Department created successfully!');
      }
      setShowModal(false);
      fetchDepartments();
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
      await api.delete(`/team/departments/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = departments.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageGuard moduleName="Departments">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Building2 className="w-6 h-6 text-blue-500" />
            </div>
            Departments
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Manage company departments and their details.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all w-fit"
        >
          <Plus className="w-4 h-4" /> Create Department
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search departments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
            <Building2 className="w-12 h-12 mx-auto text-slate-300 dark:text-gray-700 mb-3" />
            <p className="text-slate-400 dark:text-gray-500 font-medium">No departments found</p>
            {!search && (
              <button onClick={openCreate} className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
                Create First Department
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-white/10 text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-gray-600">
              <span>Department</span>
              <span>Created</span>
              <span className="w-20 text-right">Actions</span>
            </div>
            
            {/* Desktop Table Rows */}
            <div className="hidden md:block divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map(department => (
                <div
                  key={department.id}
                  className="grid grid-cols-[2fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Department name + description */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white text-sm">{department.name}</p>
                        {department.description && (
                          <p className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[300px]">{department.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Created date */}
                  <div className="text-xs text-slate-400 dark:text-gray-600">
                    {new Date(department.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end w-20">
                    <button
                      onClick={() => openEdit(department)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                      title="Edit Department"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(department)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Responsive Cards */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map(department => (
                <div key={department.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{department.name}</p>
                        {department.description && (
                          <p className="text-xs text-slate-450 dark:text-gray-500 truncate">{department.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(department)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                        title="Edit Department"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(department)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Delete Department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                    <span className="text-slate-400 dark:text-gray-500">
                      {new Date(department.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════ CREATE / EDIT MODAL ════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col z-10">

            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editTarget ? 'Edit Department' : 'Create New Department'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                  Configure the department details below.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
              <div className="px-4 sm:px-6 py-4 space-y-4">

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={departmentName}
                    onChange={e => setDepartmentName(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Description</label>
                  <textarea
                    rows={3}
                    value={departmentDesc}
                    onChange={e => setDepartmentDesc(e.target.value)}
                    placeholder="Optional description…"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Default Leave Allocation (Days)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 dark:text-gray-400">Casual</label>
                      <input
                        type="number"
                        min="0"
                        value={casualLeave}
                        onChange={e => setCasualLeave(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 dark:text-gray-400">Sick</label>
                      <input
                        type="number"
                        min="0"
                        value={sickLeave}
                        onChange={e => setSickLeave(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 dark:text-gray-400">Annual</label>
                      <input
                        type="number"
                        min="0"
                        value={annualLeave}
                        onChange={e => setAnnualLeave(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-white/10 flex gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
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
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {submitting ? 'Saving…' : editTarget ? 'Update Department' : 'Create Department'}
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
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Delete Department?</h2>
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
    </PageGuard>
  );
}
