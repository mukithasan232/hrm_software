'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Search, FileText, CheckCircle, XCircle, Eye, Trash2, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { toBDDisplay } from '@/lib/dateUtils';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function DocumentReviewPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Modal states
  const [viewingDocs, setViewingDocs] = useState<any>(null);
  const [approvingEmployee, setApprovingEmployee] = useState<any>(null);
  
  const [baseSalary, setBaseSalary] = useState('');
  const [salaryAccount, setSalaryAccount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/documents');
      setEmployees(res.data);
    } catch (error) {
      toast.error('Failed to fetch document verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingEmployee) return;
    
    setActionLoading(true);
    try {
      await api.post(`/employees/${approvingEmployee.id}/verify`, {
        action: 'APPROVE',
        baseSalary: parseFloat(baseSalary) || 0,
        salaryAccount
      });
      toast.success('Employee verified and approved!');
      setApprovingEmployee(null);
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve employee');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (employeeId: string) => {
    if (!confirm("Are you sure you want to REJECT this employee's documents? They will need to re-upload.")) return;
    
    try {
      await api.post(`/employees/${employeeId}/verify`, {
        action: 'REJECT'
      });
      toast.success('Employee documents rejected.');
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject employee');
    }
  };

  const handleDelete = async (employeeId: string) => {
    if (!confirm("Are you sure you want to DELETE this employee's documents and reset them to UNVERIFIED?")) return;
    
    try {
      await api.delete(`/admin/documents?employeeId=${employeeId}`);
      toast.success('Employee documents deleted and status reset.');
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to delete documents');
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            Document Review
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and verify employee uploaded documents.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchDocuments}
            disabled={loading}
            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative flex-1 sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-indigo-500">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <div className="w-full overflow-x-auto rounded-lg shadow-sm">
<table className="w-full text-left text-sm whitespace-nowrap min-w-max">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-500 dark:text-slate-400 font-semibold tracking-wide">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Documents</th>
                  <th className="px-6 py-4">Upload Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => {
                    let docsArray: string[] = [];
                    try {
                      docsArray = typeof emp.documents === 'string' ? JSON.parse(emp.documents) : emp.documents;
                    } catch (e) {
                      docsArray = [];
                    }
                    if (!Array.isArray(docsArray)) docsArray = [];

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{emp.name}</span>
                            <span className="text-xs text-slate-500">{emp.employeeId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          <span className="bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-white/10">
                            {docsArray.length} file{docsArray.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {toBDDisplay(emp.updatedAt, 'MMM dd, yyyy - hh:mm a')}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                              emp.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                            }`}
                          >
                            {emp.verificationStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 flex justify-end gap-2">
                          <button
                            onClick={() => setViewingDocs({ employee: emp, docs: docsArray })}
                            title="View Documents"
                            className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setBaseSalary('');
                              setSalaryAccount('');
                              setApprovingEmployee(emp);
                            }}
                            title="Approve"
                            className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 rounded-lg transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(emp.id)}
                            title="Reject (Needs Re-upload)"
                            className="p-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 rounded-lg transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            title="Delete Documents & Reset"
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-base font-medium">No pending documents found</p>
                      <p className="text-sm mt-1">All employees are currently verified or haven't uploaded documents yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
</div>
          </div>
        )}
      </div>

      {/* VIEW DOCUMENTS MODAL */}
      {viewingDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-white/10">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Documents: {viewingDocs.employee.name}
              </h2>
              <button onClick={() => setViewingDocs(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-100/50 dark:bg-black/20">
              {viewingDocs.docs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {viewingDocs.docs.map((docUrl: string, idx: number) => {
                    const isPdf = docUrl.toLowerCase().endsWith('.pdf');
                    const fullUrl = docUrl.startsWith('http') ? docUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''}${docUrl}`;
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate pr-4">Document {idx + 1}</span>
                          <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline shrink-0">Open original</a>
                        </div>
                        <div className="relative w-full rounded-lg overflow-hidden border border-slate-100 dark:border-white/5 flex-1 bg-slate-50 dark:bg-slate-900 flex items-center justify-center min-h-[300px]">
                          {isPdf ? (
                            <iframe src={fullUrl} className="w-full h-[400px]" title={`Document ${idx + 1}`} />
                          ) : (
                            <img src={fullUrl} alt={`Document ${idx + 1}`} className="max-w-full max-h-[400px] object-contain" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertTriangle className="w-12 h-12 mb-3 opacity-50" />
                  <p>No valid document files found.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button
                onClick={() => setViewingDocs(null)}
                className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE MODAL */}
      {approvingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10">
              <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Approve Employee
              </h2>
              <button onClick={() => setApprovingEmployee(null)} className="text-emerald-600/50 hover:text-emerald-600 dark:hover:text-emerald-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApprove}>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  You are about to approve <strong className="text-slate-800 dark:text-white">{approvingEmployee.name}</strong>. Please provide their initial salary details to complete the verification.
                </p>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1.5">Base Salary *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={baseSalary}
                    onChange={e => setBaseSalary(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="e.g. 25000"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1.5">Salary Account Details (Optional)</label>
                  <textarea
                    value={salaryAccount}
                    onChange={e => setSalaryAccount(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 custom-scrollbar"
                    placeholder="Bank name, Account No..."
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setApprovingEmployee(null)}
                  className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !baseSalary}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
