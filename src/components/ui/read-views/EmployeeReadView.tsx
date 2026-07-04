import React, { useState } from 'react';
import { User, Mail, Building2, Briefcase, KeyRound, CalendarDays, Hash, CheckCircle, Loader2, FileText } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function EmployeeReadView({ id, initialData }: { id: string | number | null, initialData: any }) {
  const { user: currentUser } = useAuth();
  const isAdmin = (currentUser as any)?.role?.toUpperCase().includes('ADMIN') || 
                  currentUser?.roles?.some((r: any) => r.name?.toUpperCase().includes('ADMIN')) || 
                  String((currentUser as any)?.designation || '').toUpperCase().includes('ADMIN');
  const isSelf = currentUser?.id === String(id);
  const canEditBankInfo = isAdmin || isSelf;

  const [isApproving, setIsApproving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [employeeData, setEmployeeData] = useState(initialData);
  const [baseSalary, setBaseSalary] = useState(initialData?.baseSalary || '');
  const [salaryAccount, setSalaryAccount] = useState(initialData?.salaryAccount || '');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-sm text-slate-500 animate-pulse">Fetching employee data...</p>
      </div>
    );
  }

  const handleVerificationAction = async (action: 'APPROVE' | 'REJECT') => {
    try {
      setIsApproving(true);
      await api.post(`/employees/${id}/verify`, { action, baseSalary, salaryAccount });

      if (action === 'APPROVE') {
        toast.success('Documents approved! Account activated and email sent.');
        setEmployeeData((prev: any) => ({ ...prev, verificationStatus: 'ACTIVE', baseSalary }));
      } else {
        toast.success('Documents rejected and user notified.');
        setEmployeeData((prev: any) => ({ ...prev, verificationStatus: 'REJECTED' }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${action.toLowerCase()} documents`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleResetVerification = async () => {
    if (!window.confirm("Reset this employee's verification? They will need to re-submit their documents.")) return;
    setIsResetting(true);
    try {
      const res = await api.patch(`/employees/${employeeData.id}/reset-verification`);
      setEmployeeData((prev: any) => ({ ...prev, ...res.data.user }));
      toast.success("Verification reset successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reset verification");
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveSalaryAccount = async () => {
    try {
      setIsSavingAccount(true);
      await api.put(`/users/${id}`, { salaryAccount });
      toast.success('Salary account updated successfully');
      setEmployeeData((prev: any) => ({ ...prev, salaryAccount }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update salary account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const emp = employeeData;
  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        {emp.profileImage ? (
          <img
            src={`${BACKEND}${emp.profileImage}`}
            alt={emp.name}
            className="h-24 w-24 rounded-full object-cover border-4 border-slate-50 dark:border-slate-700 shadow-md"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-md flex-shrink-0">
            {emp.name?.charAt(0)?.toUpperCase()}
          </div>
        )}

        <div className="text-center sm:text-left flex-1 mt-2 sm:mt-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">{emp.name}</h2>
          <p className="text-sm font-medium text-indigo-500 mt-1 capitalize">{emp.designation?.name || emp.designation || 'Employee'}</p>
          <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${emp.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'}`}>
              {emp.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 capitalize">
              {emp.role || emp.userType || 'user'}
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 capitalize">
              {emp.employeeType?.replace('_', ' ') || 'In-House'}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Verification Section */}
      {isAdmin && ['PENDING_VERIFICATION', 'UNVERIFIED'].includes(emp.verificationStatus) && (
        <div className="bg-amber-50 dark:bg-amber-500/10 p-6 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-500/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-amber-800 dark:text-amber-500 font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Pending Verification
              </h3>
              <p className="text-amber-700 dark:text-amber-600 text-sm mt-1">
                This employee has uploaded documents for verification.
              </p>

              {emp.documents && emp.documents.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {emp.documents.map((doc: any, idx: number) => {
                    const rawUrl = typeof doc === 'string' ? doc : (doc.url || '');
                    const filenamePart = rawUrl.split('/').pop() || '';
                    const name = filenamePart.replace(/^\d+-/, '') || `Document ${idx + 1}`;
                    const url = rawUrl.startsWith('http') ? rawUrl : `${BACKEND}${rawUrl}`;
                    return (
                      <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-500/30 w-full max-w-sm">
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> {name}
                        </span>
                        <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm font-bold">
                          View
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-red-500 mt-3 font-semibold">No documents found. Employee might have bypassed upload.</p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm font-semibold text-amber-900 dark:text-amber-400">Base Salary:</label>
                <input 
                  type="number" 
                  value={baseSalary} 
                  onChange={(e) => setBaseSalary(e.target.value)}
                  placeholder="Enter base salary"
                  className="px-3 py-1.5 border border-amber-300 dark:border-amber-500/50 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={() => handleVerificationAction('REJECT')}
                disabled={isApproving}
                className="w-full sm:w-auto shrink-0 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-red-500/20 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject'}
              </button>
              <button
                onClick={() => handleVerificationAction('APPROVE')}
                disabled={isApproving || !emp.documents || emp.documents.length === 0}
                title={(!emp.documents || emp.documents.length === 0) ? "Cannot approve without uploaded documents" : ""}
                className="w-full sm:w-auto shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Grid */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-500" />
          Employee Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Employee ID</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{emp.employeeId || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Address</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{emp.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Department</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{emp.department || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Date of Joining</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Base Salary</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{emp.baseSalary ? `৳${Number(emp.baseSalary).toLocaleString()}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Leave Adjustments</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{emp.leaveAdjustment ?? '0'}</p>
          </div>
          <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Salary / Bank Account</p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={salaryAccount}
                onChange={e => setSalaryAccount(e.target.value)}
                placeholder="Enter Salary/Bank Account details"
                disabled={!canEditBankInfo}
                className="flex-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-700/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSaveSalaryAccount}
                disabled={!canEditBankInfo || isSavingAccount}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSavingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Account'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Appointment Letter</p>
            {emp.appointmentLetter ? (
              <div className="flex items-center gap-4 mt-2">
                <a href={`${BACKEND}${emp.appointmentLetter}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  View Letter
                </a>
                
                {isAdmin && (
                  <button 
                    onClick={handleResetVerification}
                    disabled={isResetting}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                  >
                    {isResetting ? 'Resetting...' : 'Reset Verification'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-sm italic mt-2">No document submitted yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
