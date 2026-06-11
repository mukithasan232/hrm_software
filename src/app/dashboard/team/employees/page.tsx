'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Plus, Search, Building2, User, Mail, UploadCloud, X,
  RefreshCw, Key, Pencil, Trash2, AlertTriangle, Link as LinkIcon,
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useDeviceSync } from '@/hooks/useDeviceSync';
import PasswordValidator from '@/components/ui/PasswordValidator';
import { usePermissions } from '@/hooks/usePermissions';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

type EmployeeType = 'REMOTE' | 'IN_HOUSE';

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  designation?: { id: string; name: string } | null;
  designationId?: string | null;
  employeeType: EmployeeType;
  department?: string;
  profileImage?: string;
  isActive: boolean;
  zk_enroll_number?: number | null;
}

interface Designation {
  id: string;
  name: string;
}

// ─── Shared input / select class ─────────────────────────────────────────────
const fieldCls =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all';
const labelCls = 'text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider';

// ─── Designation Selector with empty-state guard ──────────────────────────────
function DesignationSelect({
  value,
  onChange,
  designations,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  designations: Designation[];
  required?: boolean;
}) {
  return (
    <select
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={fieldCls}
    >
      <option value="">— Select Designation —</option>
      {designations.map(d => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();

  // Legacy fallback if permissions are not set up yet
  const legacyAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'].includes(
    (user as any)?.designation || ''
  );

  const canCreate = can('Users', 'canCreate') || legacyAdmin;
  const canEditUser = can('Users', 'canEdit') || legacyAdmin;
  const canDelete = can('Users', 'canDelete') || legacyAdmin;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [unregisteredUsers, setUnregisteredUsers] = useState<{deviceUserId: number, name: string}[]>([]);
  const [loadingUnregistered, setLoadingUnregistered] = useState(false);

  const fetchUnregistered = async () => {
    setLoadingUnregistered(true);
    try {
      const res = await api.get('/device/users');
      setUnregisteredUsers(res.data.users || []);
      toast.success('Fetched users from device successfully');
    } catch(e) {
      console.error(e);
      toast.error('Failed to fetch from device');
    } finally {
      setLoadingUnregistered(false);
    }
  };

  // ── Add Modal ──────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Device Sync Hook ───────────────────────────────────────────────────────
  const { syncToDevice, isSyncing } = useDeviceSync();

  // ── Edit Modal ─────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Delete Modal ───────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Permissions Modal ──────────────────────────────────────────────────────
  const [permsTarget, setPermsTarget] = useState<Employee | null>(null);
  const [permsMatrix, setPermsMatrix] = useState<any>({});
  const [permsSubmitting, setPermsSubmitting] = useState(false);
  const [permsLoading, setPermsLoadingState] = useState(false);

  const MODULES = ['Emails', 'Users', 'Attendance', 'Teams', 'Leaves', 'Payroll'];

  const openPermissions = async (emp: Employee) => {
    setPermsTarget(emp);
    setPermsLoadingState(true);
    // init empty
    const initMatrix: any = {};
    MODULES.forEach(mod => {
      initMatrix[mod] = { canRead: false, canCreate: false, canEdit: false, canDelete: false };
    });
    setPermsMatrix(initMatrix);

    try {
      const res = await api.get(`/users/${emp.id}/permissions`);
      if (res.data && res.data.length > 0) {
        const loadedMatrix = { ...initMatrix };
        res.data.forEach((p: any) => {
          loadedMatrix[p.moduleName] = {
            canRead: p.canRead,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete
          };
        });
        setPermsMatrix(loadedMatrix);
      }
    } catch (err) {
      toast.error('Failed to load user permissions');
    } finally {
      setPermsLoadingState(false);
    }
  };

  const handlePermsSubmit = async () => {
    if (!permsTarget) return;
    setPermsSubmitting(true);
    try {
      await api.post(`/users/${permsTarget.id}/permissions`, { matrix: permsMatrix });
      toast.success('Custom permissions saved successfully!');
      setPermsTarget(null);
    } catch (err) {
      toast.error('Failed to save permissions');
    } finally {
      setPermsSubmitting(false);
    }
  };

  // ── Add Form State ─────────────────────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formType, setFormType] = useState<EmployeeType>('IN_HOUSE');
  const [formDepartment, setFormDepartment] = useState('');
  const [formZkEnroll, setFormZkEnroll] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [nidFile, setNidFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);

  // ── Edit Form State (mirrors add) ──────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editType, setEditType] = useState<EmployeeType>('IN_HOUSE');
  const [editDepartment, setEditDepartment] = useState('');
  const [editZkEnroll, setEditZkEnroll] = useState('');

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, desRes, deptRes] = await Promise.all([
        fetch('/api/employees').then(r => r.json()),
        api.get('/team/designations').then(r => r.data).catch(() => []),
        api.get('/team/departments').then(r => r.data).catch(() => []),
      ]);
      if (Array.isArray(empRes)) setEmployees(empRes);
      if (Array.isArray(desRes)) setDesignations(desRes);
      if (Array.isArray(deptRes)) setDepartments(deptRes);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    setFormPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  };

  const resetAddForm = () => {
    setFormName(''); setFormEmail(''); setFormPassword('');
    setFormDesignation(''); setFormDepartment(''); setFormZkEnroll('');
    setFormType('IN_HOUSE'); setCvFile(null); setNidFile(null); setCertFile(null);
  };

  const openEdit = (emp: Employee) => {
    setEditName(emp.name);
    setEditEmail(emp.email);
    setEditDesignation(emp.designationId || emp.designation?.id || '');
    setEditType(emp.employeeType);
    setEditDepartment(emp.department || '');
    setEditZkEnroll(emp.zk_enroll_number ? emp.zk_enroll_number.toString() : '');
    setEditZkEnroll(emp.zk_enroll_number ? emp.zk_enroll_number.toString() : '');
    setEditTarget(emp);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formPassword) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', formName);
      formData.append('email', formEmail);
      formData.append('password', formPassword);
      if (formDesignation) formData.append('designationId', formDesignation);
      formData.append('employeeType', formType);
      if (formDepartment) formData.append('department', formDepartment);
      if (formZkEnroll) formData.append('zk_enroll_number', formZkEnroll);
      if (cvFile) formData.append('cv', cvFile);
      if (nidFile) formData.append('nid', nidFile);
      if (certFile) formData.append('certificates', certFile);

      const res = await fetch('/api/employees', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to add employee');

      toast.success('Employee added successfully!');
      
      // Auto-sync to ZKTeco device
      if (data.user && data.user.id && formZkEnroll) {
        await syncToDevice(data.user.id);
      }
      
      setShowAddModal(false);
      resetAddForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSubmitting(true);
    try {
      const payload: any = {
        name: editName,
        department: editDepartment,
        employeeType: editType,
      };
      if (editDesignation) payload.designationId = editDesignation;
      if (editZkEnroll) payload.zk_enroll_number = editZkEnroll;

      const res = await api.put(`/users/${editTarget.id}`, payload);
      toast.success('Employee updated successfully!');
      
      // Auto-sync to ZKTeco device
      if (editZkEnroll) {
        await syncToDevice(editTarget.id);
      }
      
      setEditTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} removed successfully.`);
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Employee Directory</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm font-medium">Manage organization members</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search directory..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/50 text-slate-800 dark:text-white transition-all font-medium"
            />
          </div>
          {canCreate && (
            <button
              onClick={() => { resetAddForm(); setShowAddModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded-xl hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/25 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* No designations warning banner removed because options are now hardcoded */}

      {/* Employee Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <User className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">No employees found</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 text-sm">
            {employees.length === 0 ? 'Add your first employee to get started.' : 'No results match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <div
              key={emp.id}
              className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col"
            >
              {/* Top row: avatar + badge */}
              <div className="flex items-start justify-between">
                {emp.profileImage ? (
                  <img
                    src={`${BACKEND}${emp.profileImage}`}
                    alt={emp.name}
                    className="h-12 w-12 rounded-full object-cover border-2 border-slate-100 dark:border-white/10"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold text-base shadow-inner flex-shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-black/30 text-[10px] uppercase tracking-wider rounded-lg text-slate-500 dark:text-gray-400 font-bold border border-slate-200 dark:border-white/5">
                  {emp.employeeId}
                </span>
              </div>

              {/* Name + Designation */}
              <div className="mt-3 flex-1">
                <h3 className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate">{emp.name}</h3>
                <p className="text-xs font-semibold text-brand-primary mt-1 truncate">
                  {emp.designation?.name || <span className="text-slate-400 dark:text-gray-500 italic">No designation</span>}
                </p>
                {emp.department && (
                  <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-0.5 truncate flex items-center gap-1">
                    <Building2 className="w-3 h-3 flex-shrink-0" /> {emp.department}
                  </p>
                )}
              </div>

              {/* Footer: type badge + action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    emp.employeeType === 'REMOTE'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {emp.employeeType === 'REMOTE' ? 'Remote' : 'In-House'}
                </span>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`mailto:${emp.email}`}
                    title={`Email ${emp.name}`}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-primary transition-colors border border-slate-100 dark:border-white/5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                  {canEditUser && (
                      <>
                        <button
                          onClick={() => openPermissions(emp)}
                          title="Custom Permissions"
                          className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors border border-slate-100 dark:border-white/5"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(emp)}
                          title="Edit employee"
                          className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors border border-slate-100 dark:border-white/5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                  )}
                  {canDelete && (
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        title="Delete employee"
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors border border-slate-100 dark:border-white/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════ ADD EMPLOYEE MODAL ══════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Add New Employee</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Full Name *</label>
                  <input required type="text" value={formName} onChange={e => setFormName(e.target.value)} className={fieldCls} placeholder="John Doe" />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Email Address *</label>
                  <input required type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className={fieldCls} placeholder="john@company.com" />
                </div>

                {/* Designation */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Designation</label>
                  <DesignationSelect value={formDesignation} onChange={setFormDesignation} designations={designations} />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Department</label>
                  <select value={formDepartment} onChange={e => setFormDepartment(e.target.value)} className={fieldCls}>
                    <option value="">— Select Department —</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                {/* Employee Type */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Employee Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as EmployeeType)} className={fieldCls}>
                    <option value="">— Select Type —</option>
                    <option value="IN_HOUSE">In-House</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>

                {/* ZKTeco Enroll Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>ZKTeco Enroll Number</label>
                    <button type="button" onClick={fetchUnregistered} className="text-xs text-brand-primary font-bold hover:underline flex items-center gap-1">
                      <RefreshCw className={`w-3 h-3 ${loadingUnregistered ? 'animate-spin' : ''}`} /> Fetch from Device
                    </button>
                  </div>
                  {loadingUnregistered ? (
                    <div className={`${fieldCls} flex items-center gap-2 text-slate-500`}><RefreshCw className="w-4 h-4 animate-spin"/> Fetching...</div>
                  ) : (
                    <select value={formZkEnroll} onChange={e => setFormZkEnroll(e.target.value)} className={fieldCls}>
                      <option value="">— Select Device User —</option>
                      {unregisteredUsers.map(u => {
                        const rawId = (u as any).userId || (u as any).uid || u.deviceUserId;
                        return (
                          <option key={rawId} value={rawId ? rawId.toString() : ''}>
                            [Device ID: {rawId}] - {u.name || 'Unknown'}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Initial Password *</label>
                  <PasswordValidator
                    value={formPassword}
                    onChange={setFormPassword}
                    onGenerate={generatePassword}
                    placeholder="Min 6 characters, number, symbol"
                  />
                </div>
              </div>

              {/* Documents section */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-brand-primary" /> Onboarding Documents <span className="text-slate-400 font-normal">(PDF, optional)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'CV / Resume', state: cvFile, setter: setCvFile },
                    { label: 'NID / Passport', state: nidFile, setter: setNidFile },
                    { label: 'Certificates', state: certFile, setter: setCertFile },
                  ].map(({ label, state, setter }) => (
                    <div key={label} className="border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl p-3 text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative">
                      <input type="file" accept=".pdf" onChange={e => setter(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <span className="text-xs font-bold text-slate-500 dark:text-gray-400 block mb-0.5">{label}</span>
                      <span className="text-[10px] font-medium text-brand-primary block truncate">{state ? state.name : 'Click to attach'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || isSyncing} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/30 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                  {(submitting || isSyncing) && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isSyncing ? 'Syncing...' : submitting ? 'Creating...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ EDIT EMPLOYEE MODAL ══════════ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit Employee</h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{editTarget.email}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Full Name *</label>
                  <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className={fieldCls} />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Department</label>
                  <select value={editDepartment} onChange={e => setEditDepartment(e.target.value)} className={fieldCls}>
                    <option value="">— Select Department —</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                {/* Designation */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Designation</label>
                  <DesignationSelect value={editDesignation} onChange={setEditDesignation} designations={designations} />
                </div>

                {/* Type */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Employee Type</label>
                  <select value={editType} onChange={e => setEditType(e.target.value as EmployeeType)} className={fieldCls}>
                    <option value="">— Select Type —</option>
                    <option value="IN_HOUSE">In-House</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>

                {/* ZKTeco Enroll Number */}
                <div className="space-y-1.5">
                  <label className={labelCls}>ZKTeco Enroll Number</label>
                  {loadingUnregistered ? (
                    <div className={`${fieldCls} flex items-center gap-2 text-slate-500`}><RefreshCw className="w-4 h-4 animate-spin"/> Fetching...</div>
                  ) : (
                    <select value={editZkEnroll} onChange={e => setEditZkEnroll(e.target.value)} className={fieldCls}>
                      <option value="">— Select Unregistered Device User —</option>
                      {editZkEnroll && <option value={editZkEnroll}>[Current ID: {editZkEnroll}] (Keep current)</option>}
                      {unregisteredUsers.map(u => (
                        <option key={u.deviceUserId} value={u.deviceUserId}>[Device ID: {u.deviceUserId}] - {u.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                <button type="button" onClick={() => setEditTarget(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSubmitting || isSyncing} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                  {(editSubmitting || isSyncing) && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isSyncing ? 'Syncing...' : editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ DELETE CONFIRMATION MODAL ══════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="p-4 sm:p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Employee?</h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  This will permanently remove{' '}
                  <span className="font-semibold text-slate-700 dark:text-white">{deleteTarget.name}</span>{' '}
                  and all associated records. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {deleteSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {deleteSubmitting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Permissions Modal ─────────────────────────────────────────────────── */}
      {permsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/10">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-500" />
                  Custom Permissions for {permsTarget.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  Overrides inherited role permissions for this specific user.
                </p>
              </div>
              <button
                onClick={() => setPermsTarget(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {permsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : (
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
                                value={permsMatrix[mod]?.[action] ? 'Yes' : 'No'}
                                onChange={(e) => {
                                  const val = e.target.value === 'Yes';
                                  setPermsMatrix((prev: any) => ({
                                    ...prev,
                                    [mod]: { ...prev[mod], [action]: val }
                                  }));
                                }}
                                className={`text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none transition-colors border ${
                                  permsMatrix[mod]?.[action]
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
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-white/[0.02] shrink-0">
              <button
                onClick={() => setPermsTarget(null)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePermsSubmit}
                disabled={permsSubmitting || permsLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {permsSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {permsSubmitting ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
