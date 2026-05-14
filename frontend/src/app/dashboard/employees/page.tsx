'use client';
import { useState, useEffect } from 'react';
import {
  Plus, Search, Mail, Briefcase, Building2, Edit2,
  UserX, UserCheck, X, Save, ChevronDown
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

const DEPARTMENTS = ['Engineering', 'Finance', 'Operations', 'Sales', 'Marketing', 'HR', 'Product', 'Legal'];
const ROLES = ['Executive', 'Manager', 'HR', 'Admin'];
const BACKEND = 'http://localhost:5001';

const EMPTY_FORM = {
  employeeId: '', name: '', email: '', password: 'password123',
  role: 'Executive', department: 'Engineering', designation: '', baseSalary: '',
};

const ROLE_COLORS: Record<string, string> = {
  Admin:     'bg-red-500/15 text-red-400 border-red-500/25',
  HR:        'bg-purple-500/15 text-purple-400 border-purple-500/25',
  Manager:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Executive: 'bg-green-500/15 text-green-400 border-green-500/25',
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const canEdit = ['Admin', 'HR'].includes(user?.role || '');

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null); // null = Add new
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users');
      setEmployees(res.data);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    // Auto-generate next EMP ID
    const maxId = employees.reduce((max, e) => {
      const n = parseInt(e.employeeId?.replace(/\D/g, '') || '0');
      return n > max ? n : max;
    }, 0);
    setForm({ ...EMPTY_FORM, employeeId: `EMP${String(maxId + 1).padStart(3, '0')}` });
    setShowModal(true);
  };

  const openEdit = (emp: any) => {
    setEditTarget(emp);
    setForm({
      employeeId: emp.employeeId || '',
      name: emp.name || '',
      email: emp.email || '',
      password: '',
      role: emp.role || 'Executive',
      department: emp.department || 'Engineering',
      designation: emp.designation || '',
      baseSalary: emp.baseSalary?.toString() || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editTarget) {
        // Update existing
        const { password, employeeId, ...updateData } = form;
        await api.put(`/users/${editTarget._id}`, { ...updateData, baseSalary: Number(form.baseSalary) });
        toast.success('Employee updated!');
      } else {
        // Create new
        await api.post('/users', { ...form, baseSalary: Number(form.baseSalary) });
        toast.success('Employee added successfully!');
      }
      setShowModal(false);
      fetchEmployees();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: any) => {
    try {
      const res = await api.patch(`/users/${emp._id}/toggle`);
      toast.success(res.data.message);
      setEmployees(prev => prev.map(e => e._id === emp._id ? { ...e, isActive: res.data.isActive } : e));
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Filtering
  const filtered = employees.filter(e => {
    const matchSearch = search === '' ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
      e.department?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'All' || e.role === filterRole;
    return matchSearch && matchRole;
  });

  const initials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Employee Directory</h1>
          <p className="text-gray-400 mt-1 text-sm">{employees.length} total · {employees.filter(e => e.isActive).length} active</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all w-fit"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, ID, department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <div className="relative">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[130px]"
          >
            <option value="All" className="bg-slate-900">All Roles</option>
            {ROLES.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Employee Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="h-12 w-12 rounded-full bg-white/10" />
                <div className="h-5 w-16 bg-white/10 rounded" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-5 w-32 bg-white/10 rounded" />
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-400">No employees found{search ? ` for "${search}"` : ''}.</p>
          {canEdit && !search && (
            <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
              Add First Employee
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <div
              key={emp._id}
              className={`bg-white/5 backdrop-blur-xl border rounded-2xl p-5 transition-all group relative ${
                emp.isActive ? 'border-white/10 hover:border-blue-500/40' : 'border-white/5 opacity-60'
              }`}
            >
              {/* Inactive badge */}
              {!emp.isActive && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded-full border border-red-500/20">
                  Inactive
                </span>
              )}

              <div className="flex items-start justify-between">
                {emp.profileImage ? (
                  <img src={`${BACKEND}${emp.profileImage}`} alt={emp.name} className="h-12 w-12 rounded-full object-cover border-2 border-white/10" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                    {initials(emp.name)}
                  </div>
                )}
                <span className="px-2 py-0.5 bg-black/30 text-xs rounded-lg text-gray-400 font-mono">{emp.employeeId}</span>
              </div>

              <div className="mt-3">
                <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors leading-tight">{emp.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{emp.designation || 'Staff'}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Building2 className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-500">{emp.department || 'General'}</span>
                </div>
              </div>

              <div className="mt-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${ROLE_COLORS[emp.role] || ROLE_COLORS['Executive']}`}>
                  {emp.role}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-xs text-gray-500">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{emp.email}</span>
              </div>

              {/* Actions (Admin/HR only) */}
              {canEdit && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => openEdit(emp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-all"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(emp)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      emp.isActive
                        ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20'
                        : 'text-green-400 bg-green-500/10 hover:bg-green-500/20 border-green-500/20'
                    }`}
                  >
                    {emp.isActive ? <><UserX className="w-3 h-3" /> Deactivate</> : <><UserCheck className="w-3 h-3" /> Activate</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-slate-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-white">{editTarget ? 'Edit Employee' : 'Add New Employee'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editTarget ? `Editing ${editTarget.name}` : 'Fill in details to create a new account'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee ID */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={form.employeeId}
                    onChange={e => setForm({ ...form, employeeId: e.target.value })}
                    disabled={!!editTarget}
                    placeholder="EMP001"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">Role *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {ROLES.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                  </select>
                </div>

                {/* Full Name */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="John Smith"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    disabled={!!editTarget}
                    placeholder="john.smith@company.com"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Password (only for new employee) */}
                {!editTarget && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-gray-400 font-medium">Initial Password</label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="password123"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    <p className="text-xs text-gray-500">Employee can change this after first login</p>
                  </div>
                )}

                {/* Designation */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">Designation</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={e => setForm({ ...form, designation: e.target.value })}
                    placeholder="Software Engineer"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">Department</label>
                  <select
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                  </select>
                </div>

                {/* Base Salary */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Base Salary (per month)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      value={form.baseSalary}
                      onChange={e => setForm({ ...form, baseSalary: e.target.value })}
                      placeholder="65000"
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                >
                  <Save className="w-4 h-4" />
                  {submitting ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
