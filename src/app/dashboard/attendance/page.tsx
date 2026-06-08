'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Search, Download, RefreshCw, Plus, Clock, User as UserIcon, X } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [checkOutCount, setCheckOutCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [manualEntry, setManualEntry] = useState({
    employeeId: '',
    punchType: 'CheckIn',
    timestamp: new Date().toISOString().slice(0, 16)
  });
  const [dateRange, setDateRange] = useState('today');

  const fetchLogs = async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      const filterParam = dateRange === 'all-time' ? 'all' : dateRange;
      const res = await api.get(`/attendance/logs?filter=${filterParam}&_t=${Date.now()}`);
      const data = res.data;
      const logsArray = Array.isArray(data) ? data : (data?.logs ?? []);
      setLogs(logsArray);
      setTotalLogs(data?.total ?? logsArray.length);
      setCheckInCount(data?.checkInCount ?? 0);
      setCheckOutCount(data?.checkOutCount ?? 0);
      setManualCount(data?.manualCount ?? 0);
    } catch {
      toast.error('Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users');
      const empList = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setEmployees(empList);
    } catch {
      console.error('Failed to fetch employees');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [dateRange]);

  useEffect(() => {
    fetchEmployees();

    // Robust 3-second polling to fetch latest data automatically
    const intervalId = setInterval(() => {
      fetchLogs(true);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [dateRange]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.post('/attendance/sync-users');
      toast.success(t('device_sync_complete') || 'Device sync complete!');
    } catch (e: any) {
      console.warn('Device sync skipped/failed:', e.message);
    }
    await fetchLogs(false);
    toast.success(t('logs_loaded_success') || 'Latest logs loaded from database!');
    setSyncing(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/attendance/manual', manualEntry);
      toast.success(t('manual_entry_success') || 'Manual entry added successfully');
      setIsModalOpen(false);
      fetchLogs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('manual_entry_failed') || 'Failed to add manual entry');
    } finally {
      setLoading(false);
    }
  };

  const handlePremiumExport = async () => {
    const activeLogs = logs.filter(log => 
      log.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (log.employeeName && log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (activeLogs.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      // Create CSV header
      const headers = ['Employee Name', 'Employee ID', 'Timestamp', 'Punch Type'];
      
      // Map data to rows
      const rows = activeLogs.map(log => [
        `"${log.employeeName || 'N/A'}"`,
        `"${log.employeeId || 'Unknown'}"`,
        `"${new Date(log.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}"`,
        `"${log.punchType || 'Unknown'}"`
      ]);

      // Combine headers and rows with a true newline character
      // Prepend the UTF-8 BOM (\uFEFF) to force Excel to recognize the encoding and column delimiters correctly
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      // Create Blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Attendance_Export_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Export successful!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("An error occurred during export.");
    }
  };

  const filteredLogs = logs.filter(log => 
    log.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (log.employeeName && log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getFilterPrefixKey = () => {
    switch (dateRange) {
      case 'today': return 'todays';
      case 'yesterday': return 'yesterdays';
      case 'week': return 'this_weeks';
      case 'month': return 'this_months';
      case 'all-time': return 'total';
      default: return 'total';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{t('attendanceLogs')}</h1>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">{t('live') || 'Live'}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 dark:text-gray-400 text-sm">{filteredLogs.length} {t('total')} {t('attendanceLogs')}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 font-medium"
          >
            <Plus className="w-4 h-4" /> {t('manualEntry')}
          </button>
          
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer font-medium"
          >
            <option value="today" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('today')}</option>
            <option value="yesterday" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('yesterday')}</option>
            <option value="week" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('this_week')}</option>
            <option value="month" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('this_month')}</option>
            <option value="all-time" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('all_time')}</option>
          </select>
 
          <button 
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 font-medium shadow-md shadow-indigo-500/10"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {t('sync_data') || 'Sync Data'}
          </button>

          <button 
            onClick={handlePremiumExport}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition-all font-medium"
          >
            <Download className="w-4 h-4" /> {t('export')}
          </button>
        </div>
      </div>
 
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:border-emerald-500/30 transition-colors shadow-sm dark:shadow-md">
          <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">{t(getFilterPrefixKey() as any)} {t('checkIn')}</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {checkInCount}
          </p>
        </div>
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:border-orange-500/30 transition-colors shadow-sm dark:shadow-md">
          <p className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">{t(getFilterPrefixKey() as any)} {t('checkOut')}</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {checkOutCount}
          </p>
        </div>
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:border-blue-500/30 transition-colors shadow-sm dark:shadow-md">
          <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">{t(getFilterPrefixKey() as any)} {t('manualEntry')}</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {manualCount}
          </p>
        </div>
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:border-purple-500/30 transition-colors shadow-sm dark:shadow-md">
          <p className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">{t('device_sync')}</p>
          <div className="flex items-center gap-2 mt-1">
             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className="text-xl font-bold text-slate-900 dark:text-white">{t('active_status')}</p>
          </div>
        </div>
      </div>
 
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
 
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450 dark:text-gray-500" />
            <input 
              type="text" 
              placeholder={t('search_id_name')}
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-black/40 text-slate-800 dark:text-gray-300 text-sm uppercase tracking-wider border-b border-slate-200 dark:border-white/10 font-bold">
                <th className="px-6 py-4 font-bold">{t('employee')}</th>
                <th className="px-6 py-4 font-bold">{t('timestamp')}</th>
                <th className="px-6 py-4 font-bold">{t('punchType')}</th>
                <th className="px-6 py-4 font-bold">{t('device_ip_col')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading && logs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">{t('loading_logs')}</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">{t('noRecords')}</td></tr>
              ) : (
                filteredLogs.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-left-2 duration-300">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-white font-bold">{row?.employeeName || 'N/A'}</span>
                        <span className="text-slate-500 dark:text-gray-500 text-xs font-semibold">ID: {row?.employeeId || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-gray-200">
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold">{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date(row.timestamp))}</span>
                        <span className="text-slate-550 dark:text-gray-500 mt-0.5 font-medium">{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }).format(new Date(row.timestamp))}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        row.punchType?.toLowerCase() === 'checkout'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      }`}>
                        {row.punchType?.toLowerCase() === 'checkout' ? t('checkOut') || 'Check Out' : t('checkIn') || 'Check In'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500 dark:text-gray-500 text-sm">
                      {row.deviceId === 'Manual Entry' ? (
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <Clock className="w-3 h-3" /> {t('manual') || 'Manual'}
                        </span>
                      ) : row.deviceId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
  
      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('manual_attendance') || 'Manual Attendance'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="px-4 sm:px-6 py-4 space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('select_employee') || 'Select Employee'}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <select 
                    required
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none font-semibold"
                    value={manualEntry.employeeId}
                    onChange={(e) => setManualEntry({...manualEntry, employeeId: e.target.value})}
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('select_an_employee') || 'Select an employee...'}</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.employeeId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{emp.name} (ID: {emp.employeeId})</option>
                    ))}
                  </select>
                </div>
              </div>
  
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('punchType') || 'Punch Type'}</label>
                  <select 
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none font-semibold"
                    value={manualEntry.punchType}
                    onChange={(e) => setManualEntry({...manualEntry, punchType: e.target.value})}
                  >
                    <option value="CheckIn" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('checkIn') || 'Check In'}</option>
                    <option value="CheckOut" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('checkOut') || 'Check Out'}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('time') || 'Time'}</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                    value={manualEntry.timestamp}
                    onChange={(e) => setManualEntry({...manualEntry, timestamp: e.target.value})}
                  />
                </div>
              </div>
  
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 font-medium"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? (t('saving') || 'Saving...') : (t('save_entry') || 'Save Entry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

