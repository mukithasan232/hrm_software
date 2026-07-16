'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, XCircle, Calendar, Send, FileText, Paperclip, Check, X,
  ChevronDown, AlertCircle, User, Clock, TrendingUp, Award,
  Loader2, ShieldCheck, Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

const ANNUAL_LEAVE_QUOTA = 20;

// ─── Custom Smooth Dropdown ───────────────────────────────────────────────────
interface DropdownOption { value: string; label: string; description?: string; color?: string }
function SmoothDropdown({ options, value, onChange, placeholder = 'Select…', icon: Icon }: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center w-full bg-slate-50 dark:bg-black/20 border rounded-xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none gap-2 ${
          open ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'
        } ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}
      >
        {Icon && <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <span className="flex-1 text-left truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900/95 backdrop-blur-xl border border-slate-200 dark:border-gray-700/80 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                value === opt.value
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
              }`}
            >
              {opt.color && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.color}`} />}
              <div>
                <div>{opt.label}</div>
                {opt.description && <div className="text-[11px] text-slate-400 dark:text-gray-500 font-normal mt-0.5">{opt.description}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    Approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    Rejected:  'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    Pending:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg[status] ?? cfg.Pending}`}>
      {status}
    </span>
  );
}

// ─── Leave Balance Widget ─────────────────────────────────────────────────────
function LeaveBalanceWidget({ used, total }: { used: number; total: number }) {
  const remaining = Math.max(0, total - used);
  const pct = Math.min(100, (used / total) * 100);
  const bars = [
    { label: 'Total', value: total, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/20' },
    { label: 'Used',  value: used,  color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-500/20' },
    { label: 'Left',  value: remaining, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20' },
  ];
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-2xl">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 rounded-xl bg-indigo-500/10">
          <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Leave Balance</h3>
      </div>

      {/* Circular Progress */}
      <div className="flex justify-center mb-5">
        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-white/10" />
            <circle
              cx="56" cy="56" r="48" fill="none" strokeWidth="8"
              stroke="url(#leaveGrad)"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 48}`}
              strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="leaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-800 dark:text-white">{remaining}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Days Left</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {bars.map(b => (
          <div key={b.label} className={`${b.bg} rounded-xl p-3 text-center`}>
            <div className={`text-xl font-black ${b.color}`}>{b.value}</div>
            <div className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider mt-0.5">{b.label}</div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-slate-400 font-medium mb-1.5">
          <span>Usage</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Recent Activity Widget ───────────────────────────────────────────────────
function RecentActivityWidget({ leaves, canManage }: { leaves: any[]; canManage: boolean }) {
  const recent = [...leaves].sort((a, b) => new Date(b.createdAt ?? b.startDate).getTime() - new Date(a.createdAt ?? a.startDate).getTime()).slice(0, 4);
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-emerald-500/10">
          <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Recent Activity</h3>
      </div>
      {recent.length === 0 ? (
        <div className="text-center py-6 text-slate-400 dark:text-gray-500 text-sm">No leave history yet.</div>
      ) : (
        <div className="space-y-3">
          {recent.map((l: any) => (
            <div key={l.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                l.status === 'Approved' ? 'bg-emerald-500' : l.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                {canManage && l.employee?.name && (
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate">{l.employee.name}</div>
                )}
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{l.type} Leave</div>
                <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">
                  {new Date(l.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  {' – '}
                  {new Date(l.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Policy Widget ────────────────────────────────────────────────────────────
function PolicyWidget() {
  const rules = [
    { icon: ShieldCheck, text: 'Paid leave deducts from your 20-day annual balance.' },
    { icon: Info,        text: 'Unpaid leave affects payroll but not balance.' },
    { icon: Award,       text: 'Attach supporting documents for sick leave.' },
    { icon: Calendar,    text: 'Apply at least 1 day in advance when possible.' },
  ];
  return (
    <div className="bg-gradient-to-br from-indigo-500/5 to-violet-500/5 border border-indigo-200/60 dark:border-indigo-500/20 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-indigo-500/10">
          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Leave Policy</h3>
      </div>
      <div className="space-y-2.5">
        {rules.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <Icon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-slate-600 dark:text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeavesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdminRole = user?.roles?.some((r: any) => ['Admin', 'Super Admin'].includes(r?.name || r)) || false;
  const isAdminDesignation = ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'].includes(user?.designation || '');
  const canManage = isAdminRole || isAdminDesignation;

  const [leaves, setLeaves]               = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [employees, setEmployees]         = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Form state
  const [paymentType, setPaymentType]       = useState('');
  const [leaveCategory, setLeaveCategory]   = useState('');
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');
  const [reason, setReason]                 = useState('');
  const [attachment, setAttachment]         = useState<File | null>(null);
  const [submitting, setSubmitting]         = useState(false);
  const [highlightedId, setHighlightedId]   = useState<string | null>(null);

  // Inline validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!paymentType)                              e.paymentType = 'Please select a leave type.';
    if (paymentType === 'Paid Leave' && !leaveCategory) e.leaveCategory = 'Please select a category.';
    if (!startDate)                               e.startDate = 'Start date is required.';
    if (!endDate)                                 e.endDate = 'End date is required.';
    if (startDate && endDate && endDate < startDate) e.endDate = 'End date cannot be before start date.';
    if (!reason.trim())                            e.reason = 'Please provide a reason for your leave.';
    return e;
  };

  const buildLeaveType = (): string => {
    if (paymentType === 'Unpaid Leave') return 'Unpaid';
    if (paymentType === 'Emergency Leave') return 'EMERGENCY';
    if (paymentType === 'Paid Leave' && leaveCategory === 'Sick Leave') return 'Sick';
    if (paymentType === 'Paid Leave' && leaveCategory === 'Casual Leave') return 'Casual';
    return '';
  };

  const getRemainingLeaves = () => {
    const targetUserId = canManage && selectedEmployeeId ? selectedEmployeeId : user?.id;
    if (!targetUserId) return ANNUAL_LEAVE_QUOTA;
    const approved = leaves.filter((l: any) =>
      (l.employeeId === targetUserId || l.userId === targetUserId) && l.status === 'Approved'
    );
    const taken = approved.reduce((sum: number, l: any) => sum + (l.totalDays || 1), 0);
    return Math.max(0, ANNUAL_LEAVE_QUOTA - taken);
  };

  const getUsedLeaves = () => {
    const targetUserId = canManage && selectedEmployeeId ? selectedEmployeeId : user?.id;
    if (!targetUserId) return 0;
    const approved = leaves.filter((l: any) =>
      (l.employeeId === targetUserId || l.userId === targetUserId) && l.status === 'Approved'
    );
    return approved.reduce((sum: number, l: any) => sum + (l.totalDays || 1), 0);
  };

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leaves/all');
      setLeaves(res.data);
    } catch { toast.error('Failed to load leaves'); }
    finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch { console.error('Failed to load employees'); }
  };

  useEffect(() => {
    if (user) {
      fetchLeaves().then(() => {
        if (typeof window !== 'undefined') {
          const leaveId = new URLSearchParams(window.location.search).get('id');
          if (leaveId) {
            setHighlightedId(leaveId);
            setTimeout(() => document.getElementById(`leave-${leaveId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            const url = new URL(window.location.href);
            url.searchParams.delete('id');
            window.history.replaceState({}, '', url.toString());
            setTimeout(() => setHighlightedId(null), 3000);
          }
        }
      });
      if (canManage) fetchEmployees();
    }
  }, [user, canManage]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    const leaveType = buildLeaveType();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', leaveType);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('reason', reason);
      if (canManage && selectedEmployeeId) formData.append('targetEmployeeId', selectedEmployeeId);
      if (attachment) formData.append('attachment', attachment);

      await api.post('/leaves/apply', formData);
      toast.success('Leave applied successfully!');
      fetchLeaves();
      router.refresh();
      setPaymentType(''); setLeaveCategory(''); setStartDate(''); setEndDate('');
      setReason(''); setSelectedEmployeeId(''); setAttachment(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to apply');
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/leaves/status/${id}`, { status });
      toast.success(`Leave ${status} & Notification Sent`);
      fetchLeaves();
    } catch { toast.error('Failed to update status'); }
  };

  const field = 'w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all text-sm font-semibold placeholder:font-normal placeholder:text-slate-400';
  const fieldError = 'border-red-400 dark:border-red-500/60 focus:ring-red-500/20 focus:border-red-500';
  const label = 'block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider mb-1.5';
  const errMsg = (key: string) => errors[key] ? (
    <p className="flex items-center gap-1 text-red-500 dark:text-red-400 text-xs mt-1.5 font-medium">
      <AlertCircle className="w-3 h-3 flex-shrink-0" /> {errors[key]}
    </p>
  ) : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Leave Management</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            {canManage ? 'Review and manage all employee leave requests.' : 'Submit a new leave request and track your history.'}
          </p>
        </div>
      </div>

      {/* ── 2-Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ═══════════════════════════════════════════════════════════════════
            LEFT: Apply Form  (col-span-8)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-5">

          {/* Apply for Leave Card */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-2xl overflow-hidden">
            {/* Card Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Apply for Leave</h2>
                <p className="text-xs text-slate-400 dark:text-gray-500">Fill in the details to submit your leave request</p>
              </div>
            </div>

            <form onSubmit={handleApply} className="p-6 space-y-5" noValidate>

              {/* Admin: Employee Selector */}
              {canManage && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-4 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20">
                  <label className={label}>
                    <User className="w-3 h-3 inline mr-1" />Apply on behalf of
                  </label>
                  <SmoothDropdown
                    icon={User}
                    value={selectedEmployeeId}
                    onChange={setSelectedEmployeeId}
                    placeholder="Self (Apply for myself)"
                    options={[
                      { value: '', label: 'Self — Apply for myself' },
                      ...employees.map((emp: any) => ({
                        value: emp.id,
                        label: `${emp.name}`,
                        description: `ID: ${emp.employeeId}`
                      }))
                    ]}
                  />
                </div>
              )}

              {/* Leave Type Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Leave Type *</label>
                  <SmoothDropdown
                    icon={FileText}
                    value={paymentType}
                    onChange={(v) => { setPaymentType(v); setLeaveCategory(''); setErrors(p => ({ ...p, paymentType: '' })); }}
                    placeholder="Select type…"
                    options={[
                      { value: 'Paid Leave',   label: 'Paid Leave',   color: 'bg-emerald-500', description: 'Deducted from annual balance' },
                      { value: 'Unpaid Leave', label: 'Unpaid Leave', color: 'bg-red-500',     description: 'Affects payroll only' },
                      { value: 'Emergency Leave', label: 'Emergency Leave', color: 'bg-orange-500', description: 'For urgent situations, bypasses some checks' },
                    ]}
                  />
                  {errMsg('paymentType')}
                </div>

                {/* Category (Conditional) */}
                {paymentType === 'Paid Leave' && (
                  <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                    <label className={label}>Category *</label>
                    <SmoothDropdown
                      icon={Award}
                      value={leaveCategory}
                      onChange={(v) => { setLeaveCategory(v); setErrors(p => ({ ...p, leaveCategory: '' })); }}
                      placeholder="Select category…"
                      options={[
                        { value: 'Sick Leave',   label: 'Sick Leave',   color: 'bg-red-400',   description: 'Medical / illness' },
                        { value: 'Casual Leave', label: 'Casual Leave', color: 'bg-blue-400',  description: 'Personal / casual' },
                      ]}
                    />
                    {errMsg('leaveCategory')}
                  </div>
                )}
              </div>

              {/* Unpaid info banner */}
              {paymentType === 'Unpaid Leave' && (
                <div className="flex items-start gap-2.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl px-4 py-3 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                    Unpaid leave won't affect your annual balance but <strong>will impact your payroll</strong> for the period.
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>
                    <Calendar className="w-3 h-3 inline mr-1" />Start Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setErrors(p => ({ ...p, startDate: '' })); }}
                      className={`${field} ${errors.startDate ? fieldError : ''}`}
                    />
                  </div>
                  {errMsg('startDate')}
                </div>
                <div>
                  <label className={label}>
                    <Calendar className="w-3 h-3 inline mr-1" />End Date *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => { setEndDate(e.target.value); setErrors(p => ({ ...p, endDate: '' })); }}
                    className={`${field} ${errors.endDate ? fieldError : ''}`}
                  />
                  {errMsg('endDate')}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className={label}>
                  <FileText className="w-3 h-3 inline mr-1" />Reason *
                </label>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setErrors(p => ({ ...p, reason: '' })); }}
                  placeholder="Describe the reason for your leave request…"
                  className={`${field} resize-none ${errors.reason ? fieldError : ''}`}
                />
                {errMsg('reason')}
              </div>

              {/* Attachment */}
              <div>
                <label className={label}>
                  <Paperclip className="w-3 h-3 inline mr-1" />Supporting Document <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-black/20 border border-dashed border-slate-300 dark:border-white/20 hover:border-indigo-400 dark:hover:border-indigo-500/60 rounded-xl px-4 py-3 text-slate-500 dark:text-gray-400 cursor-pointer transition-all group">
                    <Paperclip className="w-4 h-4 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                    <span className="text-sm truncate">{attachment ? attachment.name : 'Click to attach PDF, Image, or Document'}</span>
                    <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                  </label>
                  {attachment && (
                    <button type="button" onClick={() => setAttachment(null)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors flex-shrink-0">
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Submitting…' : 'Submit Leave Request'}
              </button>
            </form>
          </div>

          {/* Leave Requests Table */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {canManage ? 'All Leave Requests' : 'My Leave History'}
              </h2>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-black/30 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-white/10">
                    {canManage && <th className="px-6 py-3">Employee</th>}
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Doc</th>
                    <th className="px-6 py-3">Status</th>
                    {canManage && <th className="px-6 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                  {loading ? (
                    <tr><td colSpan={6} className="py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto" />
                    </td></tr>
                  ) : leaves.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400 dark:text-gray-500">No leave records found.</td></tr>
                  ) : (
                    leaves.map((l: any) => (
                      <tr
                        id={`leave-${l.id}`}
                        key={l.id}
                        className={`transition-colors ${highlightedId === l.id
                          ? 'bg-indigo-50 dark:bg-indigo-500/10'
                          : 'hover:bg-slate-50/60 dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        {canManage && (
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {l.employee?.name}
                            <span className="block text-xs text-slate-400 dark:text-gray-500 font-normal">{l.employee?.employeeId}</span>
                          </td>
                        )}
                        <td className="px-6 py-4 font-semibold text-slate-800 dark:text-gray-200 whitespace-nowrap">{l.type}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {new Date(l.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' – '}
                          {new Date(l.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          {l.attachment ? (
                            <a href={l.attachment} target="_blank" rel="noopener noreferrer"
                              className="text-indigo-600 dark:text-blue-400 hover:text-indigo-800 dark:hover:text-blue-300 flex items-center gap-1 font-semibold text-xs whitespace-nowrap">
                              <FileText className="w-3.5 h-3.5" /> View
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={l.status} />
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            {l.status === 'Pending' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => updateStatus(l.id, 'Approved')}
                                  className="p-1 text-green-600 bg-green-100 rounded hover:bg-green-200 transition"
                                  title="Approve"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => updateStatus(l.id, 'Rejected')}
                                  className="p-1 text-red-600 bg-red-100 rounded hover:bg-red-200 transition"
                                  title="Reject"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT: Widgets sidebar  (col-span-4)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
          <LeaveBalanceWidget used={getUsedLeaves()} total={ANNUAL_LEAVE_QUOTA} />
          <RecentActivityWidget leaves={leaves} canManage={canManage} />
          <PolicyWidget />
        </div>

      </div>
    </div>
  );
}
