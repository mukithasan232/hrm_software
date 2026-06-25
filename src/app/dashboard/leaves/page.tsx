'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Calendar, Send, FileText, Paperclip } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function LeavesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'].includes(user?.designation || '');

  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Apply leave form state
  const [paymentType, setPaymentType] = useState('');       // 'Paid Leave' | 'Unpaid Leave'
  const [leaveCategory, setLeaveCategory] = useState('');   // 'Sick Leave' | 'Casual Leave' (only for Paid)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Build the combined type string for the API
  const buildLeaveType = (): string => {
    if (paymentType === 'Unpaid Leave') return 'Unpaid';
    if (paymentType === 'Paid Leave' && leaveCategory === 'Sick Leave') return 'Sick';
    if (paymentType === 'Paid Leave' && leaveCategory === 'Casual Leave') return 'Casual';
    return '';
  };

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leaves/all');
      setLeaves(res.data);
    } catch (e) {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      // If it returns an array directly, set it, else check res.data.data
      setEmployees(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (e) {
      console.error('Failed to load employees', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeaves();
      if (canManage) fetchEmployees();
    }
  }, [user, canManage]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate two-tier selection
    if (!paymentType) {
      toast.error('Please select a Leave Type (Paid or Unpaid).');
      return;
    }
    if (paymentType === 'Paid Leave' && !leaveCategory) {
      toast.error('Please select a Category (Sick or Casual) for Paid Leave.');
      return;
    }

    const leaveType = buildLeaveType();

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', leaveType);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('reason', reason);
      if (canManage && selectedEmployeeId) {
        formData.append('targetEmployeeId', selectedEmployeeId);
      }
      if (attachment) formData.append('attachment', attachment);

      await api.post('/leaves/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Leave applied successfully');
      fetchLeaves();
      router.refresh();
      // Reset form
      setPaymentType('');
      setLeaveCategory('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setSelectedEmployeeId('');
      setAttachment(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to apply');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/leaves/status/${id}`, { status });
      toast.success(`Leave ${status} & Notification Sent`);
      fetchLeaves();
    } catch (e: any) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Leave Management</h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1">
          {canManage ? 'Review and manage employee leave requests.' : 'Submit a new leave request and view history.'}
        </p>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Application Form for Executives/Employees */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 sm:px-6 py-4 shadow-sm dark:shadow-2xl h-fit">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-indigo-650 dark:text-blue-400" /> Apply for Leave
            </h2>
            <form onSubmit={handleApply} className="space-y-4 md:space-y-6">
              
              {/* Admin Employee Selection */}
              {canManage && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Select Employee (Admin Only)</label>
                  <div className="relative">
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 appearance-none font-semibold"
                    >
                      <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Self (Apply for myself)</option>
                      {employees.map((emp: any) => (
                        <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {emp.name} ({emp.employeeId})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Field 1: Primary — Paid vs Unpaid */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Leave Type</label>
                <div className="relative">
                  <select
                    value={paymentType}
                    onChange={(e) => {
                      setPaymentType(e.target.value);
                      setLeaveCategory(''); // reset category when payment type changes
                    }}
                    required
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 appearance-none font-semibold"
                  >
                    <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-400">Select type…</option>
                    <option value="Paid Leave" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Paid Leave</option>
                    <option value="Unpaid Leave" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Unpaid Leave</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Field 2: Conditional — Category (only for Paid Leave) */}
              {paymentType === 'Paid Leave' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Category</label>
                  <div className="relative">
                    <select
                      value={leaveCategory}
                      onChange={(e) => setLeaveCategory(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 appearance-none font-semibold"
                    >
                      <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-400">Select category…</option>
                      <option value="Sick Leave" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Sick Leave</option>
                      <option value="Casual Leave" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Casual Leave</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 pl-1">This leave will be deducted from your annual balance.</p>
                </div>
              )}

              {/* Info tag for Unpaid */}
              {paymentType === 'Unpaid Leave' && (
                <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl px-4 py-3 animate-in fade-in duration-200">
                  <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">Unpaid leave will not be deducted from your annual leave balance but will affect your payroll.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Start Date</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:[&::-webkit-calendar-picker-indicator]:filter-[invert(1)] font-semibold" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">End Date</label>
                  <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:[&::-webkit-calendar-picker-indicator]:filter-[invert(1)] font-semibold" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Reason</label>
                <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 font-semibold"></textarea>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Document (Optional)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-black/20 border border-dashed border-slate-350 dark:border-white/20 hover:border-indigo-500/50 dark:hover:border-blue-500/50 rounded-xl px-4 py-3 text-slate-500 dark:text-gray-400 cursor-pointer transition-all">
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="text-sm truncate font-medium">{attachment ? attachment.name : 'Select PDF/Image/Doc'}</span>
                    <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                  </label>
                  {attachment && (
                    <button type="button" onClick={() => setAttachment(null)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              <button 
                type="submit" disabled={submitting}
                className="w-full py-3 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] flex justify-center items-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Submit Request
              </button>
            </form>
          </div>
        </div>
 
        {/* Leave Requests Table */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-white/10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {canManage ? 'All Leave Requests' : 'My Leave History'}
              </h2>
            </div>
            <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-black/40 text-slate-800 dark:text-gray-300 text-sm uppercase tracking-wider border-b border-slate-200 dark:border-white/10 font-bold">
                    {canManage && <th className="px-6 py-4 font-bold">Employee</th>}
                    <th className="px-6 py-4 font-bold">Type</th>
                    <th className="px-6 py-4 font-bold">Duration</th>
                    <th className="px-6 py-4 font-bold">Doc</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    {canManage && <th className="px-6 py-4 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">Loading...</td></tr>
                  ) : leaves.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">No leaves found.</td></tr>
                  ) : (
                    leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        {canManage && (
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">
                            {l.employee?.name} <span className="block text-xs text-slate-500 dark:text-gray-500 font-normal mt-0.5">{l.employee?.employeeId}</span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-slate-900 dark:text-gray-200 font-semibold">{l.type}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-gray-400">
                          {new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {l.attachment ? (
                            <a 
                              href={l.attachment}
                              target="_blank" rel="noopener noreferrer"
                              className="text-indigo-650 dark:text-blue-400 hover:text-indigo-850 dark:hover:text-blue-300 flex items-center gap-1 font-semibold"
                            >
                              <FileText className="w-4 h-4" /> View
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-600">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            l.status === 'Approved' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' :
                            l.status === 'Rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                            'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            {l.status === 'Pending' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => updateStatus(l.id, 'Approved')} className="p-1 text-green-500 hover:bg-green-500/20 rounded transition-colors"><CheckCircle className="w-5 h-5" /></button>
                                <button onClick={() => updateStatus(l.id, 'Rejected')} className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors"><XCircle className="w-5 h-5" /></button>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-gray-500 italic">Reviewed</span>
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

      </div>
    </div>
  );
}
