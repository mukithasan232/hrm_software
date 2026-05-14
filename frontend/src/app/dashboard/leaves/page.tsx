'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Calendar, Send, FileText, Paperclip } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function LeavesPage() {
  const { user } = useAuth();
  const isManagerOrHR = ['Admin', 'HR', 'Manager'].includes(user?.role || '');

  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply leave form state
  const [type, setType] = useState('Sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    if (user) fetchLeaves();
  }, [user]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('reason', reason);
      if (attachment) formData.append('attachment', attachment);

      await api.post('/leaves/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Leave applied successfully');
      fetchLeaves();
      setStartDate(''); setEndDate(''); setReason(''); setAttachment(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to apply');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/leaves/status/${id}`, { status });
      toast.success(`Leave ${status}`);
      fetchLeaves();
    } catch (e: any) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white">Leave Management</h1>
        <p className="text-gray-400 mt-1">
          {isManagerOrHR ? 'Review and manage employee leave requests.' : 'Submit a new leave request and view history.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Application Form for Executives/Employees */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl h-fit">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-blue-400" /> Apply for Leave
            </h2>
            <form onSubmit={handleApply} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Leave Type</label>
                <select 
                  value={type} onChange={(e) => setType(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="Sick" className="bg-slate-900">Sick Leave</option>
                  <option value="Casual" className="bg-slate-900">Casual Leave</option>
                  <option value="Annual" className="bg-slate-900">Annual Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Start Date</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">End Date</label>
                  <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Reason</label>
                <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Document (Optional)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center gap-2 bg-black/20 border border-dashed border-white/20 hover:border-blue-500/50 rounded-xl px-4 py-3 text-gray-400 cursor-pointer transition-all">
                    <Paperclip className="w-4 h-4" />
                    <span className="text-sm truncate">{attachment ? attachment.name : 'Select PDF/Image/Doc'}</span>
                    <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                  </label>
                  {attachment && (
                    <button type="button" onClick={() => setAttachment(null)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
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
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">
                {isManagerOrHR ? 'All Leave Requests' : 'My Leave History'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/40 text-gray-400 text-sm uppercase tracking-wider">
                    {isManagerOrHR && <th className="px-6 py-4 font-medium">Employee</th>}
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Duration</th>
                    <th className="px-6 py-4 font-medium">Doc</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    {isManagerOrHR && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
                  ) : leaves.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No leaves found.</td></tr>
                  ) : (
                    leaves.map((l) => (
                      <tr key={l._id} className="hover:bg-white/[0.02] transition-colors">
                        {isManagerOrHR && (
                          <td className="px-6 py-4 text-white font-medium">
                            {l.employeeId?.name} <span className="block text-xs text-gray-500">{l.employeeId?.employeeId}</span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-gray-300">{l.type}</td>
                        <td className="px-6 py-4 text-gray-400">
                          {new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {l.attachment ? (
                            <a 
                              href={`http://localhost:5001${l.attachment}`} 
                              target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <FileText className="w-4 h-4" /> View
                            </a>
                          ) : (
                            <span className="text-gray-600">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            l.status === 'Approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            l.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        {isManagerOrHR && (
                          <td className="px-6 py-4 text-right">
                            {l.status === 'Pending' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => updateStatus(l._id, 'Approved')} className="p-1 text-green-400 hover:bg-green-500/20 rounded transition-colors"><CheckCircle className="w-5 h-5" /></button>
                                <button onClick={() => updateStatus(l._id, 'Rejected')} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"><XCircle className="w-5 h-5" /></button>
                              </div>
                            ) : (
                              <span className="text-gray-500 italic">Reviewed</span>
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
