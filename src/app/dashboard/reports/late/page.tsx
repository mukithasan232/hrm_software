'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Download, AlertCircle, Clock } from 'lucide-react';
import { exportToCsv } from '@/utils/exportCsv';
import api from '@/services/api';
import { toBDDisplay } from '@/lib/dateUtils';

function LateReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize dates from URL or default to current month
  const from = searchParams.get('startDate');
  const to = searchParams.get('endDate');
  const range = searchParams.get('range');
  
  const [customStartDate, setCustomStartDate] = useState(from || '');
  const [customEndDate, setCustomEndDate] = useState(to || '');
  const [dateRange, setDateRange] = useState(range || (from && to ? 'custom' : 'last-30-days')); // fallback

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
      const res = await api.get(`/reports/late${query}`);
      setData(res.data.data || []);
    } catch (err) {
      console.error('Error fetching late report:', err);
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
      'Shift Start': toBDDisplay(item.shiftStart, 'hh:mm a'),
      'Check-In Time': toBDDisplay(item.checkInTime, 'hh:mm a'),
      'Late Minutes': item.lateMinutes
    }));
    exportToCsv(formattedData, `Late_Arrival_Report_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">Generate and export organizational reports.</p>
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
        <button className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-orange-500/10 text-orange-600 border border-orange-500/20 shadow-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Late Arrivals
        </button>
        <button className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 border border-transparent opacity-50 cursor-not-allowed">
          Overtime (Coming Soon)
        </button>
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
                <th className="px-6 py-4">Shift Start</th>
                <th className="px-6 py-4">Check-In</th>
                <th className="px-6 py-4 rounded-tr-2xl">Late Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                      Loading report...
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No late arrivals found for the selected date range.
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
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {item.department}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
                      {toBDDisplay(item.shiftStart, 'hh:mm a')}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
                      {toBDDisplay(item.checkInTime, 'hh:mm a')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md">
                        {item.lateMinutes >= 60 ? `${Math.floor(item.lateMinutes / 60)}h ${item.lateMinutes % 60}m` : `${item.lateMinutes}m`}
                      </span>
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

export default function LateReportPage() {
  return (
    <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div></div>}>
      <LateReportContent />
    </Suspense>
  );
}
