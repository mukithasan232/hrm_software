'use client';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { useBrand } from '@/context/BrandContext';
import { Search, Download, RefreshCw, Plus, Clock, User as UserIcon, X, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { toUTCFromBD, toBDDisplay, getBDNowLocal, getBDToday } from '@/lib/dateUtils';
import { calculateWorkingHours } from '@/lib/timeUtils';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { io as socketIO } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { checkPermission } from '@/utils/checkPermission';
import { useDetailsStore } from '@/store/useDetailsStore';
import MetricDetailsModal from '@/components/attendance/MetricDetailsModal';

const WorkModeBadge = ({ mode, source }: { mode?: string, source?: string }) => {
  const isManual = source?.toLowerCase().includes('manual') || mode === 'REMOTE';
  if (isManual) {
    return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-1.5 py-0.5 rounded-md mt-1 font-semibold flex w-max items-center gap-1">🏠 Remote</span>;
  }
  return <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded-md mt-1 font-semibold flex w-max items-center gap-1">🏢 In-House</span>;
};

export default function AttendancePage() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [serverSummaries, setServerSummaries] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [checkOutCount, setCheckOutCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [manualDetails, setManualDetails] = useState<any[]>([]);
  const [absentCount, setAbsentCount] = useState(0);
  const [absentDetails, setAbsentDetails] = useState<any[]>([]);
  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [metricModalTitle, setMetricModalTitle] = useState('');
  const [metricModalData, setMetricModalData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const { user } = useAuth();
  const openDetails = useDetailsStore(state => state.openDetails);
  
  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (log.employeeName && log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [logs, searchTerm]);

  const dailySummaries = useMemo(() => {
    return serverSummaries.filter(summary => 
      summary.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (summary.employeeName && summary.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a: any, b: any) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.checkInRaw || 0) - (a.checkInRaw || 0);
    });
  }, [serverSummaries, searchTerm]);

  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const isAdminUser = ['admin', 'super admin', 'system administrator', 'hrm manager'].includes(
    (typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation)?.toLowerCase()
  ) || user?.roles?.some((r: any) => ['admin', 'super admin', 'system administrator', 'hrm manager'].includes((r?.name || r)?.toLowerCase()));
  
  const canCreateAll = isAdminUser || checkPermission(user, 'Attendance', 'create');

  const [manualEntry, setManualEntry] = useState({
    employeeId: user?.employeeId || user?.id || '',
    punchType: 'CheckIn',
    timestamp: getBDNowLocal()
  });
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(getBDToday());
  const [customEndDate, setCustomEndDate] = useState(getBDToday());
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const fetchLogs = async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      
      let queryParams = `department=${departmentFilter}&_t=${Date.now()}`;
      
      if (dateRange === 'custom') {
        queryParams += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      } else if (dateRange && dateRange !== 'all-time') {
        queryParams += `&filter=${dateRange}`;
      } else {
        queryParams += `&filter=all`;
      }

      const res = await api.get(`/attendance/logs?${queryParams}`, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data = res.data;
      const logsArray = Array.isArray(data) ? data : (data?.logs ?? []);
      setLogs(logsArray);
      setServerSummaries(data?.summaries ?? []);
      setTotalLogs(data?.total ?? logsArray.length);

      setCheckInCount(data?.checkInCount ?? 0);
      setCheckOutCount(data?.checkOutCount ?? 0);
      setManualCount(data?.metrics?.manualPunch?.count ?? data?.manualCount ?? 0);
      setManualDetails(data?.metrics?.manualPunch?.details ?? []);
      setAbsentCount(data?.metrics?.absent?.count ?? data?.absentCount ?? 0);
      setAbsentDetails(data?.metrics?.absent?.details ?? []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      const empList = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setEmployees(empList);
    } catch {
      console.error('Failed to fetch employees');
    }
  };

  const fetchDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const res = await api.get('/team/departments');
      const deptList = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setDepartments(deptList);
    } catch {
      console.error('Failed to fetch departments');
    } finally {
      setDepartmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [dateRange, customStartDate, customEndDate, departmentFilter]);

  const updateManualEntryForEmployee = (empId: string) => {
    let calculatedPunchType = 'CheckIn';
    if (empId && logs) {
      const today = getBDToday();
      const userLogsToday = logs.filter(log => {
        const logDate = toBDDisplay(log.timestamp, 'yyyy-MM-dd');
        return (String(log.employeeId) === String(empId) || String(log.user?.employeeId) === String(empId)) && logDate === today;
      });

      userLogsToday.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastAction = userLogsToday[0];

      if (lastAction && (lastAction.punchType === 'CheckIn' || lastAction.punchType?.toLowerCase().includes('in'))) {
        calculatedPunchType = 'CheckOut';
      }
    }

    setManualEntry(prev => ({
      ...prev,
      employeeId: empId,
      punchType: calculatedPunchType,
      timestamp: getBDNowLocal()
    }));
  };

  const handleOpenModal = () => {
    const defaultEmpId = user?.employeeId || user?.id || '';
    updateManualEntryForEmployee(defaultEmpId);
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();

    // Polling every 15s as a fallback (Socket.IO is the primary real-time path)
    const intervalId = setInterval(() => {
      fetchLogs(true);
    }, 15000);

    // Socket.IO: instant table refresh when any punch or sync fires
    const socket = socketIO({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socket.on('attendanceUpdate', () => {
      fetchLogs(true);
    });
    socket.on('new-attendance', () => {
      fetchLogs(true);
    });

    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [dateRange, customStartDate, customEndDate, departmentFilter]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.post('/attendance/sync-users');
      await fetchLogs(false);
      router.refresh();
      toast.success('Real-time data synced from device!');
    } catch (e: any) {
      console.warn('Device sync skipped/failed:', e.message);
      toast.error('Failed to sync from device');
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    // Admin Proxy Check: if current logged-in user is NOT the one selected in the modal
    const isAdminProxy = user?.id !== manualEntry.employeeId && user?.employeeId !== manualEntry.employeeId;

    if (isAdminProxy) {
      setLoading(true);
      try {
        await api.post('/attendance/manual', { employeeId: manualEntry.employeeId, punchType: manualEntry.punchType, locationAddress: 'Admin Manual Entry' });
        toast.success(t('manual_entry_success') || 'Manual entry added successfully');
        setIsModalOpen(false);
        fetchLogs();
      } catch (error: any) {
        toast.error(error.response?.data?.message || t('manual_entry_failed') || 'Failed to add manual entry');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    
    if (window.isSecureContext === false) {
      toast.error("GPS requires a secure connection (HTTPS or localhost). Cannot fetch location.");
      return;
    }

    setLoading(true);
    toast("Fetching location...", { id: 'geo-fetch', icon: '📍' });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Use purely the required fields, letting the backend handle the time
          await api.post('/attendance/manual', { employeeId: manualEntry.employeeId, punchType: manualEntry.punchType, latitude, longitude });
          toast.dismiss('geo-fetch');
          toast.success(t('manual_entry_success') || 'Manual entry added successfully');
          setIsModalOpen(false);
          fetchLogs();
        } catch (error: any) {
          toast.dismiss('geo-fetch');
          toast.error(error.response?.data?.message || t('manual_entry_failed') || 'Failed to add manual entry');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        toast.dismiss('geo-fetch');
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("You denied location access. Please allow it in browser settings.");
          setLoading(false);
        } else {
          toast.error("Location unavailable. Proceeding with fallback mode.");
          api.post('/attendance/manual', { employeeId: manualEntry.employeeId, punchType: manualEntry.punchType, locationAddress: 'Location Unavailable' })
            .then(() => {
               toast.success(t('manual_entry_success') || 'Manual entry added successfully (Fallback)');
               setIsModalOpen(false);
               fetchLogs();
            })
            .catch((err: any) => {
               toast.error(err.response?.data?.message || t('manual_entry_failed') || 'Failed to add manual entry');
            })
            .finally(() => setLoading(false));
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleExportExcel = async () => {
    const activeLogs = logs.filter(log => 
      log.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (log.employeeName && log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (activeLogs.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);
    setShowExportMenu(false);
    try {
      // Group logs by Employee and Date
      const grouped: Record<string, any> = {};
      activeLogs.forEach(log => {
        const dateStr = toBDDisplay(log.timestamp, 'yyyy-MM-dd');
        const key = `${log.employeeId}_${dateStr}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            employeeId: log.employeeId,
            employeeName: log.employeeName || 'N/A',
            date: dateStr,
            checkIn: null,
            checkOut: null,
            checkInRaw: null,
            checkOutRaw: null,
          };
        }
        
        const timestampTime = new Date(log.timestamp).getTime();
        
        if (log.punchType === 'CheckIn') {
          if (!grouped[key].checkInRaw || timestampTime < grouped[key].checkInRaw) {
            grouped[key].checkInRaw = timestampTime;
            grouped[key].checkIn = toBDDisplay(log.timestamp, 'hh:mm a');
          }
        } else if (log.punchType === 'CheckOut' || log.punchType === 'Checkout') {
          if (!grouped[key].checkOutRaw || timestampTime > grouped[key].checkOutRaw) {
            grouped[key].checkOutRaw = timestampTime;
            grouped[key].checkOut = toBDDisplay(log.timestamp, 'hh:mm a');
          }
        }
      });

      const reportData = Object.values(grouped).map(row => {
        const emp = employees.find(e => e.id === row.employeeId) || {};
        const basicSalary = emp.baseSalary || 0;
        const allowances = emp.allowances || 0;
        
        let totalHours = 0;
        let overtimeHours = 0;
        
        if (row.checkInRaw && row.checkOutRaw) {
          const diffMs = row.checkOutRaw - row.checkInRaw;
          totalHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
          if (totalHours > 8) {
            overtimeHours = totalHours - 8;
          }
        }

        const dailyRate = basicSalary / 30;
        const netPayable = dailyRate + (allowances / 30) + (overtimeHours * (dailyRate / 8) * 1.5);

        return {
          'Employee Name': row.employeeName,
          'Employee ID': emp.employeeId || row.employeeId,
          'Date': row.date,
          'Check In': row.checkIn || '-',
          'Check Out': row.checkOut || '-',
          'Total Duty Hours': totalHours ? totalHours.toFixed(2) : '0.00',
          'Overtime Hours': overtimeHours ? overtimeHours.toFixed(2) : '0.00',
          'Basic Salary': basicSalary,
          'Other Allowances / Deductions': allowances,
          'Net Payable': netPayable ? netPayable.toFixed(2) : '0.00'
        };
      });

      await exportToExcel(reportData, `Payroll_Report_${dateRange}_${new Date().toISOString().split('T')[0]}`, dateRange === 'all-time' ? 'All Time' : dateRange);
      toast.success("Report downloaded successfully!");
    } catch (error) {
      console.error("Excel Export error:", error);
      toast.error("An error occurred during Excel export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await exportToPDF(
        dailySummaries, 
        `Attendance_Report_${dateRange}`, 
        'Daily Attendance Report', 
        brand
      );
      toast.success("PDF Downloaded!");
    } catch (error: any) {
      console.error('[PDF Export Error]:', error);
      toast.error(`Export Failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getFilterPrefixKey = () => {
    if (dateRange === getBDToday()) return 'todays';
    if (dateRange === 'all-time') return 'total';
    return ''; // specific date prefix isn't standard in translations, keep it generic
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
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleOpenModal}
            className="flex justify-center items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 font-medium w-full md:w-auto"
          >
            <Plus className="w-4 h-4" /> {t('manualEntry')}
          </button>
          
          <select 
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            disabled={syncing || departmentsLoading}
            className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none cursor-pointer font-medium w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">{departmentsLoading ? 'Loading...' : 'All Departments'}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <DateRangePicker 
              value={{ range: dateRange, start: customStartDate, end: customEndDate }}
              onChange={(val) => {
                setDateRange(val.range);
                if (val.start) setCustomStartDate(val.start);
                if (val.end) setCustomEndDate(val.end);
              }}
              disabled={syncing}
            />
          </div>
          <button 
            onClick={handleManualSync}
            disabled={syncing}
            className="flex justify-center items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 font-medium shadow-md shadow-indigo-500/10 w-full md:w-auto"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
            {syncing ? 'Syncing Live...' : (t('sync_data') || 'Sync Data')}
          </button>

          <div className="relative w-full md:w-auto">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="flex justify-center items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition-all font-medium w-full md:w-auto disabled:opacity-50"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Exporting...' : t('export')}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-full md:w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                <button 
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium text-slate-700 dark:text-gray-200 border-b border-slate-100 dark:border-white/5"
                >
                  Download Excel
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium text-slate-700 dark:text-gray-200"
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-5 gap-4">
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
        <div 
          onClick={() => { setMetricModalTitle(t(getFilterPrefixKey() as any) + ' ' + t('manualEntry')); setMetricModalData(manualDetails); setMetricModalOpen(true); }}
          className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:border-blue-500/30 transition-all shadow-sm dark:shadow-md cursor-pointer hover:shadow-lg"
        >
          <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">{t(getFilterPrefixKey() as any)} {t('manualEntry')}</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {manualCount}
          </p>
        </div>
        <div 
          onClick={() => { setMetricModalTitle(t('attendance.totalAbsent' as any)); setMetricModalData(absentDetails); setMetricModalOpen(true); }}
          className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:border-red-500/30 transition-all shadow-sm dark:shadow-md cursor-pointer hover:shadow-lg"
        >
          <p className="text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider">{t('attendance.totalAbsent' as any)}</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {absentCount}
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
        <div id="pdf-export-content" className="w-full overflow-x-auto whitespace-nowrap scrollbar-hide bg-white dark:bg-slate-900 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-black/40 text-slate-800 dark:text-gray-300 text-sm uppercase tracking-wider border-b border-slate-200 dark:border-white/10 font-bold">
                <th className="px-6 py-4 font-bold">{t('employee')}</th>
                <th className="px-6 py-4 font-bold">{t('attendance.date' as any)}</th>
                <th className="px-6 py-4 font-bold">{t('attendance.checkIn' as any)}</th>
                <th className="px-6 py-4 font-bold">{t('attendance.checkOut' as any)}</th>
                <th className="px-6 py-4 font-bold">{t('attendance.officeHour' as any)}</th>
                {isAdminUser && <th className="px-6 py-4 font-bold">{t('attendance.actions' as any)}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading && logs.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">{t('loading_logs')}</td></tr>
              ) : dailySummaries.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">{t('noRecords')}</td></tr>
              ) : (
                dailySummaries.map((row: any) => (
                  <tr 
                    key={row.id} 
                    onClick={() => openDetails('attendance', row.id, row)}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-white font-bold">{row?.employeeName}</span>
                        <WorkModeBadge mode={row.workMode} source={row.inSource} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-gray-200">
                      <span className="font-semibold">{row.date}</span>
                    </td>
                    <td className="px-6 py-4">
                      {row.checkInRaw ? (
                        <div>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            {toBDDisplay(row.checkInRaw, 'hh:mm a')}
                          </span>
                          {row.lateMinutes > 0 && (
                            <span className="block mt-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded w-max">
                              Late: {formatMinutes(row.lateMinutes)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Missing</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {row.checkOutRaw ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                            {toBDDisplay(row.checkOutRaw, 'hh:mm a')}
                          </span>
                          {row.isAutoCheckout && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-white/20 uppercase tracking-wider">
                              Auto-Checkout
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/10">
                          {row.isMissingOut ? t('attendance.missingWorking' as any) : 'Missing'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 dark:text-gray-300 font-bold">
                      {row.totalValidMs > 0 ? (
                        <div>
                          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                            <Clock className="w-4 h-4" />
                            {Math.floor(row.totalValidMs / 3600000)}h {Math.floor((row.totalValidMs % 3600000) / 60000)}m
                          </span>
                          {row.systemCalculatedOtMinutes > 0 && (
                            <div className={`mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded w-max border ${
                              row.otBadge === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400' :
                              row.otBadge === 'Rejected' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400' :
                              'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400'
                            }`}>
                              <span className="text-[10px] font-bold uppercase tracking-wider">{row.otBadge}:</span>
                              <span className="text-xs font-semibold">
                                {row.otBadge === 'Approved' ? formatMinutes(row.overtimeMinutes) : formatMinutes(row.systemCalculatedOtMinutes)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {isAdminUser && (
                      <td className="px-6 py-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            if (row.id) {
                              setEditingRecord(row);
                            } else {
                              toast.error("No underlying record found.");
                            }
                          }} 
                          className="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1.5 rounded text-xs hover:bg-blue-100 transition"
                        >
                          ✏️ {t('attendance.edit' as any)}
                        </button>
                        <button 
                          onClick={async () => {
                            if (!window.confirm("Are you sure you want to delete this attendance record?")) return;
                            try {
                              const recordId = row.id;
                              if (!recordId) throw new Error("No ID");
                              await api.delete(`/attendance/${recordId}`);
                              toast.success("Record deleted");
                              fetchLogs();
                            } catch (error) {
                              toast.error("Failed to delete record");
                            }
                          }} 
                          className="text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1.5 rounded text-xs hover:bg-red-100 transition"
                        >
                          🗑️ {t('attendance.delete' as any)}
                        </button>
                      </td>
                    )}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('manual_punch') || 'Manual Punch'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="px-4 sm:px-6 py-4 space-y-4 md:space-y-6">
              {isAdminUser && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('select_employee') || 'Select Employee'}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <select 
                    required
                    disabled={!canCreateAll}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
                    value={manualEntry.employeeId}
                    onChange={(e) => updateManualEntryForEmployee(e.target.value)}
                  >
                    {isAdminUser && <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('select_an_employee') || 'Select an employee...'}</option>}
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.employeeId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{emp.name} (ID: {emp.employeeId})</option>
                    ))}
                    {!isAdminUser && !employees.find(e => e.employeeId === user?.employeeId) && (
                      <option value={user?.employeeId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{user?.name} (ID: {user?.employeeId})</option>
                    )}
                  </select>
                </div>
              </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('punchType') || 'Punch Type'}</label>
                  <select 
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
                    value={manualEntry.punchType}
                    onChange={(e) => setManualEntry({...manualEntry, punchType: e.target.value})}
                    disabled={!isAdminUser}
                  >
                    <option value="CheckIn" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('checkIn') || 'Check In'}</option>
                    <option value="CheckOut" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{t('checkOut') || 'Check Out'}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('time') || 'Time'}</label>
                  <div className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time will be automatically recorded based on secure server time.
                  </div>
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
                  {loading ? (t('saving') || 'Saving...') : 'Punch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Attendance Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Attendance</h2>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-800 dark:text-gray-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editingRecord?.id) {
                toast.error("Error: Missing Record ID");
                return;
              }
              try {
                const formData = new FormData(e.currentTarget);
                const checkInDate = formData.get('checkIn') as string;
                const checkOutDate = formData.get('checkOut') as string;
                await api.patch(`/attendance/${editingRecord.id}`, {
                  checkIn: checkInDate || null,
                  checkOut: checkOutDate || null
                });
                toast.success("Updated Successfully");
                setEditingRecord(null);
                fetchLogs();
              } catch (err) {
                toast.error("Failed to update");
              }
            }} className="px-4 sm:px-6 py-4 space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">Check In Time</label>
                <input 
                  type="datetime-local" 
                  name="checkIn"
                  defaultValue={editingRecord.checkInRaw ? new Date(new Date(editingRecord.checkInRaw).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">Check Out Time</label>
                <input 
                  type="datetime-local" 
                  name="checkOut"
                  defaultValue={editingRecord.checkOutRaw ? new Date(new Date(editingRecord.checkOutRaw).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-colors">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {metricModalOpen && (
        <MetricDetailsModal 
          isOpen={metricModalOpen} 
          onClose={() => setMetricModalOpen(false)} 
          title={metricModalTitle} 
          data={metricModalData} 
        />
      )}
    </div>
  );
}

