'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Building2, User, Mail, UploadCloud, X,
  RefreshCw, Key, Pencil, Trash2, AlertTriangle, Link as LinkIcon, Loader2
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useDeviceSync } from '@/hooks/useDeviceSync';
import { usePermissions } from '@/hooks/usePermissions';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import PageGuard from '@/components/auth/PageGuard';
import { formatTimeStr12Hour } from '@/lib/timeUtils';
import { useDetailsStore } from '@/store/useDetailsStore';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

type EmployeeType = 'REMOTE' | 'IN_HOUSE' | 'HYBRID';

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
  zktecoId?: number | null;
  leaveConfig?: any;
  casualLeaveAdjustment?: number;
  sickLeaveAdjustment?: number;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  shift2Start?: string | null;
  shift2End?: string | null;
  verificationStatus?: string;
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
  const { user: authUser } = useAuth();
  const router = useRouter();
  const openDetails = useDetailsStore(state => state.openDetails);
  const { can, loading: permsLoading } = usePermissions();

  // Legacy fallback if permissions are not set up yet
  const legacyAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'].includes(
    (authUser as any)?.designation || ''
  );

  const canCreate = can('Users', 'canCreate') || legacyAdmin;
  const canEditUser = can('Users', 'canEdit') || legacyAdmin;
  const canDelete = can('Users', 'canDelete') || legacyAdmin;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [deviceUsers, setDeviceUsers] = useState<any[]>([]);
  const [isFetchingZk, setIsFetchingZk] = useState(false);

  const fetchUnregistered = async () => {
    setIsFetchingZk(true);
    try {
      const res = await api.get('/device/users');
      console.log('ZKTeco Data:', res.data);
      const users = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.users || []);
      setDeviceUsers(users);
      toast.success("Fetched successfully");
    } catch(e) {
      console.error(e);
      toast.error("Failed to fetch");
    } finally {
      setIsFetchingZk(false);
    }
  };



  // ── Device Sync Hook ───────────────────────────────────────────────────────
  const { syncToDevice, isSyncing } = useDeviceSync();

  // ── Edit Modal ─────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Delete Modal ───────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Edit Form State (mirrors add) ──────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editType, setEditType] = useState<EmployeeType>('IN_HOUSE');
  const [editDepartment, setEditDepartment] = useState('');
  const [editZkEnroll, setEditZkEnroll] = useState('');
  const [casualLeave, setCasualLeave] = useState<number | ''>('');
  const [sickLeave, setSickLeave] = useState<number | ''>('');
  const [annualLeave, setAnnualLeave] = useState<number | ''>('');
  const [casualLeaveAdjustment, setCasualLeaveAdjustment] = useState<number>(0);
  const [sickLeaveAdjustment, setSickLeaveAdjustment] = useState<number>(0);
  const [shiftStartTime, setShiftStartTime] = useState('');
  const [shiftEndTime, setShiftEndTime] = useState('');
  const [shift2Start, setShift2Start] = useState('');
  const [shift2End, setShift2End] = useState('');

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, desRes, deptRes] = await Promise.all([
        api.get('/employees').then(r => r.data).catch(() => []),
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




  const openEdit = (emp: Employee) => {
    setEditName(emp.name);
    setEditEmail(emp.email);
    setEditDesignation(emp.designationId || emp.designation?.id || '');
    setEditType(emp.employeeType);
    setEditDepartment(emp.department || '');
    setEditZkEnroll(emp.zktecoId ? emp.zktecoId.toString() : '');
    setCasualLeave(emp.leaveConfig?.casual ?? '');
    setSickLeave(emp.leaveConfig?.sick ?? '');
    setAnnualLeave(emp.leaveConfig?.annual ?? '');
    setCasualLeaveAdjustment(emp.casualLeaveAdjustment ?? 0);
    setSickLeaveAdjustment(emp.sickLeaveAdjustment ?? 0);
    setShiftStartTime(emp.shiftStartTime || '');
    setShiftEndTime(emp.shiftEndTime || '');
    setShift2Start(emp.shift2Start || '');
    setShift2End(emp.shift2End || '');
    setEditTarget(emp);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSubmitting(true);
    try {
      const payload: any = {
        name: editName,
        department: editDepartment,
        employeeType: editType,
        leaveConfig: {
          casual: casualLeave !== '' ? Number(casualLeave) : null,
          sick: sickLeave !== '' ? Number(sickLeave) : null,
          annual: annualLeave !== '' ? Number(annualLeave) : null,
        },
        casualLeaveAdjustment: Number(casualLeaveAdjustment),
        sickLeaveAdjustment: Number(sickLeaveAdjustment),
        shiftStartTime: shiftStartTime,
        shiftEndTime: shiftEndTime,
        shift2Start: editType === 'HYBRID' ? shift2Start : null,
        shift2End: editType === 'HYBRID' ? shift2End : null,
      };
      if (editDesignation) payload.designationId = editDesignation;
      if (editZkEnroll) payload.zktecoId = editZkEnroll;

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
    <PageGuard moduleName="Employees">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

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
              onClick={() => {
                toast.success('Redirecting to Central User Management...');
                router.push('/dashboard/team/users');
              }}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <div
              key={emp.id}
              onClick={() => openDetails('employee', emp.id, emp)}
              className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer transition-all group flex flex-col"
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
                <div className="flex flex-col items-end gap-1">
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-black/30 text-[10px] uppercase tracking-wider rounded-lg text-slate-500 dark:text-gray-400 font-bold border border-slate-200 dark:border-white/5">
                    {emp.employeeId}
                  </span>
                  {emp.verificationStatus === 'PENDING_VERIFICATION' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-[9px] uppercase tracking-wider rounded font-bold border border-amber-200 dark:border-amber-500/30">
                      Pending Verif.
                    </span>
                  )}
                </div>
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
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded">
                    CL Adj: {emp.casualLeaveAdjustment ?? 0 > 0 ? '+' : ''}{emp.casualLeaveAdjustment ?? 0}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 rounded">
                    SL Adj: {emp.sickLeaveAdjustment ?? 0 > 0 ? '+' : ''}{emp.sickLeaveAdjustment ?? 0}
                  </span>
                </div>
              </div>

              {/* Footer: type badge + action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    emp.employeeType === 'REMOTE'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                      : emp.employeeType === 'HYBRID'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {emp.employeeType === 'REMOTE' ? 'Remote' : emp.employeeType === 'HYBRID' ? 'Hybrid' : 'In-House'}
                </span>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`mailto:${emp.email}`}
                    onClick={(e) => e.stopPropagation()}
                    title={`Email ${emp.name}`}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-primary transition-colors border border-slate-100 dark:border-white/5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                  {canEditUser && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(emp); }}
                          title="Edit employee"
                          className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors border border-slate-100 dark:border-white/5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                  )}
                  {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp); }}
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



      {/* ══════════ EDIT EMPLOYEE MODAL ══════════ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex-shrink-0 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit Employee</h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{editTarget.email}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
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
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>

                {/* ZKTeco Enroll Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>ZKTeco Enroll Number</label>
                    <button
                      type="button"
                      onClick={fetchUnregistered}
                      disabled={isFetchingZk}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingZk ? 'animate-spin' : ''}`} />
                      {isFetchingZk ? 'Fetching...' : 'Fetch from Device'}
                    </button>
                  </div>
                  {isFetchingZk ? (
                    <div className={`${fieldCls} flex items-center gap-2 text-slate-500`}><RefreshCw className="w-4 h-4 animate-spin"/> Fetching...</div>
                  ) : (
                    <select value={editZkEnroll} onChange={e => setEditZkEnroll(e.target.value)} className={fieldCls}>
                      <option value="">--- Select Unregistered Device ---</option>
                      {deviceUsers.map((user: any, index: number) => (
                        <option key={index} value={user.userId}>
                          {user.name || 'Unknown User'} (ID: {user.userId})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Shift Overrides */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-2">Shift Override (Optional)</h3>
                <p className="text-[10px] text-slate-500 mb-3 mt-1">
                  Leave blank to use Department shift times.
                  {(() => {
                    const selectedDept = departments.find(d => d.name === editDepartment);
                    if (selectedDept && selectedDept.shiftStartTime && selectedDept.shiftEndTime) {
                      return (
                        <span className="inline-block mt-0.5 text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded ml-1">
                          Currently inheriting: {formatTimeStr12Hour(selectedDept.shiftStartTime)} - {formatTimeStr12Hour(selectedDept.shiftEndTime)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Shift Start Time</label>
                    <input
                      type="time"
                      value={shiftStartTime}
                      onChange={e => setShiftStartTime(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Shift End Time</label>
                    <input
                      type="time"
                      value={shiftEndTime}
                      onChange={e => setShiftEndTime(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                </div>
                {editType === 'HYBRID' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <label className={labelCls}>Shift 2 Start Time</label>
                      <input
                        type="time"
                        value={shift2Start}
                        onChange={e => setShift2Start(e.target.value)}
                        className={fieldCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>Shift 2 End Time</label>
                      <input
                        type="time"
                        value={shift2End}
                        onChange={e => setShift2End(e.target.value)}
                        className={fieldCls}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Leave Overrides */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-2">Leave Overrides (Optional)</h3>
                <p className="text-[10px] text-slate-500 mb-3">Leave blank to use Department defaults.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Casual</label>
                    <input
                      type="number"
                      min="0"
                      value={casualLeave}
                      onChange={e => setCasualLeave(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Default"
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Sick</label>
                    <input
                      type="number"
                      min="0"
                      value={sickLeave}
                      onChange={e => setSickLeave(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Default"
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Annual</label>
                    <input
                      type="number"
                      min="0"
                      value={annualLeave}
                      onChange={e => setAnnualLeave(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Default"
                      className={fieldCls}
                    />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mt-4 mb-2">Leave Adjustments (+/-)</h3>
                <p className="text-[10px] text-slate-500 mb-3">Add or subtract leaves (e.g. 2 or -1).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Casual Adjustment</label>
                    <input
                      type="number"
                      value={casualLeaveAdjustment}
                      onChange={e => setCasualLeaveAdjustment(Number(e.target.value))}
                      placeholder="0"
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Sick Adjustment</label>
                    <input
                      type="number"
                      value={sickLeaveAdjustment}
                      onChange={e => setSickLeaveAdjustment(Number(e.target.value))}
                      placeholder="0"
                      className={fieldCls}
                    />
                  </div>
                </div>
              </div>

              </div>
              {/* Actions */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex-shrink-0 flex justify-end gap-3 bg-white dark:bg-slate-900">
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

      </div>
    </PageGuard>
  );
}
