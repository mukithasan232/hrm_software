'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  UsersRound, Plus, Search, X, Save, Loader2, Trash2, Pencil,
  Mail, Building2, CalendarDays, Shield, ChevronDown, UserX, UserCheck, KeyRound, UploadCloud, RefreshCw
} from 'lucide-react';
import api from '@/services/api';
import PasswordInputWithValidator from '@/components/ui/PasswordInputWithValidator';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useInView } from 'react-intersection-observer';



const EMPTY_FORM = {
  employeeId: '',
  name: '',
  email: '',
  password: '',
  roleIds: [] as string[],
  designationId: '',
  department: 'Engineering',
  employeeType: 'IN_HOUSE',
  zktecoId: '',
  sendEmail: true,
};

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
        : 'bg-red-500/10 text-red-500 border-red-500/20'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function TeamUsersPage() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('All');

  // Pagination & Infinite Scroll State
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const { ref: scrollRef, inView } = useInView({
    threshold: 0.1,
  });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ZKTeco & Files
  const [unregisteredUsers, setUnregisteredUsers] = useState<{deviceUserId: number, name: string}[]>([]);
  const [loadingUnregistered, setLoadingUnregistered] = useState(false);

  const fetchUnregistered = async () => {
    setLoadingUnregistered(true);
    try {
      const res = await api.get('/device/users');
      setUnregisteredUsers(res.data.users || []);
      toast.success('Fetched users from device successfully');
    } catch(e) {
      toast.error('Failed to fetch from device');
    } finally {
      setLoadingUnregistered(false);
    }
  };

  // Fetch logic
  const fetchInitialData = async () => {
    try {
      const [desRes, deptRes, rolesRes] = await Promise.all([
        api.get('/team/designations'),
        api.get('/team/departments'),
        api.get('/team/roles')
      ]);
      setDesignations(desRes?.data || []);
      setDepartments(deptRes?.data || []);
      setRoles(rolesRes?.data || []);
    } catch {
      setDesignations([]);
      setDepartments([]);
      setRoles([]);
    }
  };

  const fetchUsers = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setIsFetchingNext(true);
    }

    try {
      const cursorParam = !reset && nextCursor ? `&cursor=${nextCursor}` : '';
      const res = await api.get(`/team/users?search=${encodeURIComponent(search)}&designation=${encodeURIComponent(filterDesignation)}${cursorParam}&limit=20`);
      
      const incomingUsers = res?.data?.data || [];

      if (reset) {
        setUsers(incomingUsers);
      } else {
        setUsers(prev => {
          const safePrev = prev || [];
          const newUsers = incomingUsers.filter((u: any) => !safePrev.some(p => p.id === u.id));
          return [...safePrev, ...newUsers];
        });
      }
      setNextCursor(res?.data?.nextCursor || null);
      setTotalCount(res?.data?.totalCount || 0);
    } catch {
      toast.error('Failed to load team data');
      if (reset) setUsers([]);
    } finally {
      setLoading(false);
      setIsFetchingNext(false);
    }
  }, [search, filterDesignation, nextCursor]);

  // Initial loads and debounced search
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(true);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [search, filterDesignation]); // Ignore fetchUsers to avoid cycle on nextCursor

  // Infinite Scroll Trigger
  useEffect(() => {
    if (inView && nextCursor && !isFetchingNext && !loading) {
      fetchUsers(false);
    }
  }, [inView, nextCursor, isFetchingNext, loading, fetchUsers]);

  // ── Password Generator ──
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let password = '';
    // Ensure at least one of each
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];
    // Fill the rest to 12 chars
    for (let i = password.length; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    // Shuffle
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    setForm(f => ({ ...f, password }));
  };

  // ── Modal helpers ──
  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, employeeId: '' });
    generatePassword();
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditTarget(u);
    setForm({
      employeeId: u.employeeId || '',
      name: u.name || '',
      email: u.email || '',
      password: '',
      roleIds: u.roles?.map((r: any) => r.id) || [],
      designationId: u.designationId || '',
      department: u.department || 'Engineering',
      employeeType: u.employeeType || 'IN_HOUSE',
      zktecoId: u.zktecoId?.toString() || '',
      sendEmail: false, // hidden on edit anyway
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editTarget) {
        const payload = {
          ...form,
          designationId: form.designationId || null,
        };
        const { password, employeeId, sendEmail, roleIds, employeeType, zktecoId, ...updatePayload } = payload as any;
        if (password) updatePayload.password = password;
        updatePayload.roles = form.roleIds;
        
        const formData = new FormData();
        Object.entries(updatePayload).forEach(([key, val]) => {
          if (key === 'roles') {
            formData.append('roles', JSON.stringify(val));
          } else {
            formData.append(key, val as string);
          }
        });
        await api.put(`/users/${editTarget.id}`, formData);
        toast.success('User updated!');
      } else {
        const formData = new FormData();
        formData.append('name', form.name);
        formData.append('email', form.email);
        formData.append('password', form.password);
        formData.append('employeeId', form.employeeId);
        
        if (form.designationId) formData.append('designationId', form.designationId);
        formData.append('department', form.department);
        formData.append('employeeType', form.employeeType);
        if (form.zktecoId) formData.append('zktecoId', form.zktecoId);
        formData.append('roles', JSON.stringify(form.roleIds));

        const res = await api.post('/employees', formData);
        toast.success(form.sendEmail ? 'User created & email sent!' : 'User created successfully!');
      }
      setShowModal(false);
      fetchUsers(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: any) => {
    try {
      const res = await api.patch(`/users/${u.id}/toggle`);
      toast.success(res.data.message);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: res.data.isActive } : x));
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('User deleted successfully.');
      setDeleteTarget(null);
      fetchUsers(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const initials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Unique designation names for filter — using designations list
  const allDesignationNames = Array.from(new Set([
    ...(designations || []).map(d => d.name)
  ])).sort();

  const handleRoleChange = (roleId: string, checked: boolean) => {
    const currentRoles = form.roleIds || [];
    if (checked) {
      setForm({ ...form, roleIds: [...currentRoles, roleId] });
    } else {
      setForm({ ...form, roleIds: currentRoles.filter((value) => value !== roleId) });
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <UsersRound className="w-6 h-6 text-indigo-500" />
            </div>
            Team Users
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            {totalCount} total members in your organization
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all w-fit"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, ID, department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
          />
        </div>
        <div className="relative">
          <select
            value={filterDesignation}
            onChange={e => setFilterDesignation(e.target.value)}
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-w-[140px] shadow-sm font-medium"
          >
            <option value="All" className="bg-white dark:bg-slate-900">All Designations</option>
            {allDesignationNames.map(r => (
              <option key={r} value={r} className="bg-white dark:bg-slate-900">{r}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Data Table ── */}
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        {loading && (users?.length ?? 0) === 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-slate-100 dark:bg-white/10 rounded" />
                  <div className="h-3 w-48 bg-slate-100 dark:bg-white/10 rounded" />
                </div>
                <div className="h-5 w-16 bg-slate-100 dark:bg-white/10 rounded-full" />
                <div className="h-5 w-20 bg-slate-100 dark:bg-white/10 rounded-full" />
              </div>
            ))}
          </div>
        ) : (users?.length ?? 0) === 0 ? (
          <div className="py-20 text-center">
            <UsersRound className="w-12 h-12 mx-auto text-slate-300 dark:text-gray-700 mb-3" />
            <p className="text-slate-400 dark:text-gray-500 font-medium">No users found{search ? ` for "${search}"` : ''}</p>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto pb-4">
              <div className="min-w-[900px]">
                {/* Table headers */}
                <div className="grid grid-cols-[2fr_2.5fr_1.5fr_1.5fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-100 dark:border-white/10 text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-gray-600">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Designation</span>
                  <span>Department</span>
                  <span>Status</span>
                  <span className="text-right w-28">Actions</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {(users || []).map(u => (
                    <div
                      key={u.id}
                      className="grid grid-cols-[2fr_2.5fr_1.5fr_1.5fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {initials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{u.name}</p>
                          <p className="text-xs text-slate-400 dark:text-gray-600 font-mono">{u.employeeId}</p>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-500 dark:text-gray-400 truncate">{u.email}</span>
                      </div>

                      {/* Designation */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-500 border border-indigo-500/25 truncate">
                          <Shield className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{u.designation?.name || 'Employee'}</span>
                        </span>
                      </div>

                      {/* Department */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-500 dark:text-gray-400 truncate">{u.department || '—'}</span>
                      </div>

                      {/* Status */}
                      <div><StatusBadge isActive={u.isActive} /></div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 justify-end w-28">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                          title="Edit User"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded-lg transition-all ${
                            u.isActive
                              ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
                              : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10'
                          }`}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete User"
                          disabled={u.id === authUser?.id}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Infinite Scroll Sentinel */}
            {nextCursor && (
              <div ref={scrollRef} className="py-6 flex justify-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            )}
            {!nextCursor && (users?.length ?? 0) > 0 && (
              <div className="py-4 text-center text-xs font-semibold text-slate-400 dark:text-gray-600 border-t border-slate-100 dark:border-white/5">
                End of list
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════ ADD / EDIT MODAL ════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col z-10">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editTarget ? 'Edit User' : 'Add New User'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                  {editTarget ? `Editing ${editTarget.name}` : 'Fill in the details to create a new team member'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Employee ID - Only show on edit */}
                  {editTarget && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Employee ID</label>
                      <input
                        type="text"
                        value={form.employeeId}
                        disabled
                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      />
                    </div>
                  )}


                  {/* Full Name */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="John Smith"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      disabled={!!editTarget}
                      placeholder="john@company.com"
                      className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    />
                  </div>

                  {/* Password — create only */}
                  {!editTarget && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Initial Password *</label>
                      <div className="relative flex items-center">
                        <PasswordInputWithValidator
                          value={form.password}
                          onChange={val => setForm({ ...form, password: val })}
                          onGenerate={generatePassword}
                          onValidityChange={setIsPasswordValid}
                          placeholder="Type or generate..."
                        />
                      </div>
                      
                      {/* Email Checkbox */}
                      <label className="flex items-center gap-2 mt-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={form.sendEmail}
                          onChange={e => setForm({ ...form, sendEmail: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-600 dark:text-gray-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
                          Send login credentials via email to the user
                        </span>
                      </label>
                    </div>
                  )}

                  {/* System Roles */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">System Roles *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {roles.length === 0 ? (
                        <span className="text-sm text-gray-500">Loading roles...</span>
                      ) : (
                        roles.map(role => (
                          <label key={role.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                            <input
                              type="checkbox"
                              checked={form.roleIds?.includes(role.id) || false}
                              onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
                            />
                            <span className="text-sm text-slate-700 dark:text-gray-200 font-medium">{role.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {(form.roleIds?.length ?? 0) === 0 && (
                      <p className="text-xs text-red-500 mt-1">Please select at least one role.</p>
                    )}
                  </div>

                      {/* Designation */}
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Shield className="w-3 h-3 text-indigo-500" />
                          Designation *
                        </label>
                        <div className="relative">
                          <select
                            required
                            value={form.designationId}
                            onChange={e => setForm({ ...form, designationId: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium pr-8"
                          >
                            <option value="" className="bg-white dark:bg-slate-900" disabled>— Select Designation —</option>
                            {(designations || []).map(r => (
                              <option key={r.id} value={r.id} className="bg-white dark:bg-slate-900">{r.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Department */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Department</label>
                        <div className="relative">
                          <select
                            value={form.department}
                            onChange={e => setForm({ ...form, department: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium pr-8"
                          >
                            <option value="" className="bg-white dark:bg-slate-900">— Select Department —</option>
                            {(departments || []).map(d => (
                              <option key={d.id} value={d.name} className="bg-white dark:bg-slate-900">{d.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Employee Type */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">Employee Type</label>
                        <div className="relative">
                          <select
                            value={form.employeeType}
                            onChange={e => setForm({ ...form, employeeType: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium pr-8"
                          >
                            <option value="IN_HOUSE" className="bg-white dark:bg-slate-900">In-House</option>
                            <option value="REMOTE" className="bg-white dark:bg-slate-900">Remote</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* ZKTeco Enroll Number */}
                      <div className="space-y-1 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wide">ZKTeco Enroll Number</label>
                          <button type="button" onClick={fetchUnregistered} className="text-xs text-indigo-500 font-bold hover:underline flex items-center gap-1">
                            <RefreshCw className={`w-3 h-3 ${loadingUnregistered ? 'animate-spin' : ''}`} /> Fetch from Device
                          </button>
                        </div>
                        {loadingUnregistered ? (
                          <div className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-500 flex items-center gap-2 text-sm"><RefreshCw className="w-4 h-4 animate-spin"/> Fetching...</div>
                        ) : (
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="32767"
                              value={form.zktecoId}
                              onChange={e => setForm({ ...form, zktecoId: e.target.value })}
                              list="zktecoUsersList"
                              placeholder="e.g. 1 (Manual entry or Fetch)"
                              className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                            />
                            <datalist id="zktecoUsersList">
                              {(unregisteredUsers || []).map((u: any) => (
                                <option key={u.deviceUserId || u.userId} value={u.deviceUserId || u.userId}>
                                  {u.name}
                                </option>
                              ))}
                            </datalist>
                          </div>
                        )}
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
                  disabled={submitting || (!editTarget && !isPasswordValid) || (form.roleIds?.length ?? 0) === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-red-500/20 rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Delete User?</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Permanently delete <span className="font-semibold text-slate-800 dark:text-white">{deleteTarget.name}</span>?
                All associated records will be erased. This cannot be undone.
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
