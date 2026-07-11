'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Download, AlertCircle, Clock, Check, X, Hourglass, CheckCircle2, XCircle } from 'lucide-react';
import { exportToCsv } from '@/utils/exportCsv';
import api from '@/services/api';
import { toBDDisplay } from '@/lib/dateUtils';
import toast from 'react-hot-toast';

function OvertimeReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalPending: 0, totalApprovedMinutes: 0 });
  const [loading, setLoading] = useState(false);

  const from = searchParams.get('startDate');
  const to = searchParams.get('endDate');
  const range = searchParams.get('range');
  
  const [customStartDate, setCustomStartDate] = useState(from || '');
  const [customEndDate, setCustomEndDate] = useState(to || '');
  const [dateRange, setDateRange] = useState(range || (from && to ? 'custom' : 'last-30-days'));

  useEffect(() => {
    if (from && to) {
      setCustomStartDate(from);
      setCustomEndDate(to);
      setDateRange('custom');
    }
  }, [from, to]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let query = '';
      if (from && to) {
        query = `?startDate=${from}&endDate=${to}`;
      }
      const res = await api.get(`/reports/overtime${query}`);
      setData(res.data.data || []);
      setSummary(res.data.summary || { totalPending: 0, totalApprovedMinutes: 0 });
    } catch (err) {
      console.error('Error fetching overtime report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [from, to]);

  const handleDateFilterChange = (val: { range: string; start: string; end: string }) => {
    setDateRange(val.range);
    if (val.range === 'custom' && val.start && val.end) {
      setCustomStartDate(val.start);
      setCustomEndDate(val.end);
    }
    const params = new URLSearchParams(searchParams.toString());
    if (val.range) params.set('range', val.range);
    if (val.start) params.set('startDate', val.start);
    if (val.end) params.set('endDate', val.end);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleExport = () => {
    if (data.length === 0) return;
    const formattedData = data.map(item => ({
      'Date': toBDDisplay(item.date, 'MMM dd, yyyy'),
      'Employee Name': item.employeeName,
      'Employee ID': item.employeeId,
      'Department': item.department,
      'Shift End': item.shiftEnd,
      'Check-Out Time': toBDDisplay(item.checkOutTime, 'hh:mm a'),
      'Calculated OT': formatMinutes(item.calculatedOtMinutes),
      'Approved OT': formatMinutes(item.approvedOtMinutes),
      'Status': item.otStatus
    }));
    exportToCsv(formattedData, `Overtime_Report_${new Date().toISOString().split('T')[0]}`);
  };

  const updateOtStatus = async (id: string, action: 'APPROVE' | 'REJECT', calculatedMins: number) => {
    const loadingToast = toast.loading(`${action === 'APPROVE' ? 'Approving' : 'Rejecting'} overtime...`);
    try {
      const res = await api.patch(`/reports/overtime/${id}`, {
        action,
        approvedOtMinutes: calculatedMins
      });
      if (res.data.success) {
        toast.success(`Overtime ${action === 'APPROVE' ? 'approved' : 'rejected'}.`, { id: loadingToast });
        // Optimistic update
        setData(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              otStatus: res.data.data.otStatus,
              approvedOtMinutes: res.data.data.approvedOtMinutes
            };
          }
          return item;
        }));
        
        // Update summary
        if (action === 'APPROVE') {
          setSummary(prev => ({
            totalPending: Math.max(0, prev.totalPending - 1),
            totalApprovedMinutes: prev.totalApprovedMinutes + calculatedMins
          }));
        } else {
          setSummary(prev => ({
            ...prev,
            totalPending: Math.max(0, prev.totalPending - 1),
          }));
        }
      }
    } catch (e) {
      toast.error(`Failed to update status`, { id: loadingToast });
    }
  };

  const formatMinutes = (mins: number) => {
    if (!mins || mins === 0) return '0m';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-indigo-500" />
            Overtime Controls
          </h1>
          <p className="text-sm text-slate-500 mt-1">Review, approve, and export organizational overtime data.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={{ range: dateRange, start: customStartDate, end: customEndDate }}
            onChange={handleDateFilterChange}
            disabled={loading}
          />
          <button
            onClick={handleExport}
            disabled={data.length === 0 || loading}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <Link href="/reports/late" className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 border border-transparent flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Late Arrivals
        </Link>
        <button className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm flex items-center gap-2">
          <Hourglass className="w-4 h-4" />
          Overtime
        </button>
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Hourglass className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Approvals</p>
            <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">{summary.totalPending}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Approved OT Time</p>
            <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">{formatMinutes(summary.totalApprovedMinutes)}</h3>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">Date</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4 text-center">Shift End &rarr; Out</th>
                <th className="px-6 py-4">Calculated OT</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 rounded-tr-2xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                      Calculating overtime records...
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No overtime records found (exceeding 30m threshold).
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                      {toBDDisplay(item.date, 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{item.employeeName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{item.employeeId}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                      {item.department}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{item.shiftEnd}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-white">{toBDDisplay(item.checkOutTime, 'HH:mm')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md text-xs">
                        {formatMinutes(item.calculatedOtMinutes)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.otStatus === 'PENDING' && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-amber-600 bg-amber-500/10 px-2 py-1 rounded"><Hourglass className="w-3 h-3" /> Pending</span>}
                      {item.otStatus === 'APPROVED' && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded"><CheckCircle2 className="w-3 h-3" /> Approved</span>}
                      {item.otStatus === 'REJECTED' && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-red-600 bg-red-500/10 px-2 py-1 rounded"><XCircle className="w-3 h-3" /> Rejected</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.otStatus === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => updateOtStatus(item.id, 'APPROVE', item.calculatedOtMinutes)}
                            className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                            title="Approve OT"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => updateOtStatus(item.id, 'REJECT', 0)}
                            className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                            title="Reject OT"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function OvertimeReportPage() {
  return (
    <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div></div>}>
      <OvertimeReportContent />
    </Suspense>
  );
}
