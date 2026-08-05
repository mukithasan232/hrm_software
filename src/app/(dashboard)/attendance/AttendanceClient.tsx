'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { useBrand } from '@/context/BrandContext';
import { Search, Download, RefreshCw, Plus, Clock, User as UserIcon, X, Loader2, Lock, LogIn, LogOut, Fingerprint, UserX, FileText } from 'lucide-react';
import api from '@/services/api';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { toUTCFromBD, toBDDisplay, getBDNowLocal, getBDToday } from '@/lib/dateUtils';
import { calculateWorkingHours } from '@/lib/timeUtils';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { socket } from '@/lib/socket';
import Cookies from 'js-cookie';
import { useAuth } from '@/context/AuthContext';
import { formatInTimeZone } from 'date-fns-tz';

const BD_TZ = 'Asia/Dhaka';

const getLocalDatetimeLocal = (utcDateString: Date | string) => {
  const d = new Date(utcDateString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
import { checkPermission, getPermissionScopeSync } from '@/utils/checkPermission';
import { useDetailsStore } from '@/store/useDetailsStore';
import MetricDetailsModal from '@/components/attendance/MetricDetailsModal';

import { MonitorSmartphone, Globe, UserCog, Settings2 } from 'lucide-react';
import HeaderCustomizationModal, { HeaderItemKey } from '@/components/attendance/HeaderCustomizationModal';

const PunchSourceBadge = ({ record }: { record?: any }) => {
  if (!record) return null;
  const isManual = record.inSource?.includes('Manual') || record.inSource === 'MANUAL_WEB';

  if (isManual) {
    return (
      <span className="text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20 border text-[10px] px-1.5 py-0.5 rounded-md mt-1 font-semibold flex w-max items-center gap-1">
        <UserCog className="w-3 h-3" /> Manual Entry
      </span>
    );
  }

  if (record.workMode === 'REMOTE') {
    return (
      <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 border text-[10px] px-1.5 py-0.5 rounded-md mt-1 font-semibold flex w-max items-center gap-1">
        <Globe className="w-3 h-3" /> Remote
      </span>
    );
  }

  return (
    <span className="text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20 border text-[10px] px-1.5 py-0.5 rounded-md mt-1 font-semibold flex w-max items-center gap-1">
      <MonitorSmartphone className="w-3 h-3" /> In-House
    </span>
  );
};

function AttendancePageContent() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Customization State
  const [headerOrder, setHeaderOrder] = useState<HeaderItemKey[]>(['departments', 'date', 'sync', 'export']);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [moduleConfig, setModuleConfig] = useState<any>(null);

  useEffect(() => {
    api.get('/settings/modules').then(res => {
      setModuleConfig(res.data);
      if (res.data?.isAttendanceEnabled === false) {
        router.replace('/dashboard');
      }
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem('attendance_header_layout');
    if (saved) {
      try {
        setHeaderOrder(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse header layout', e);
      }
    }
  }, []);

  const handleSaveLayout = (newOrder: HeaderItemKey[]) => {
    setHeaderOrder(newOrder);
    localStorage.setItem('attendance_header_layout', JSON.stringify(newOrder));
  };

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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(''); // NEW: Employee filter state
  const { user } = useAuth();
  const openDetails = useDetailsStore(state => state.openDetails);
  
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = log.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (log.employeeName && log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchEmp = selectedEmployeeId ? log.employeeId === selectedEmployeeId : true;
      return matchSearch && matchEmp;
    });
  }, [logs, searchTerm, selectedEmployeeId]);

  const dailySummaries = useMemo(() => {
    return serverSummaries.filter(summary => {
      const matchSearch = summary.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (summary.employeeName && summary.employeeName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchEmp = selectedEmployeeId ? summary.employeeId === selectedEmployeeId : true;
      return matchSearch && matchEmp;
    }).sort((a: any, b: any) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.checkInRaw || 0) - (a.checkInRaw || 0);
    });
  }, [serverSummaries, searchTerm, selectedEmployeeId]);

  const dynamicCheckInCount = useMemo(() => dailySummaries.length, [dailySummaries]);
  
  const dynamicCheckOutCount = useMemo(() => {
    return dailySummaries.filter((row: any) => row.checkOut !== null && row.checkOut !== undefined).length;
  }, [dailySummaries]);

  const dynamicManualCount = useMemo(() => {
    return logs.filter((log: any) => log.deviceId === 'Manual Entry' || log.isManual === true || log.punchMethod === 'WEB' || log.punchMethod === 'MANUAL').length;
  }, [logs]);

  const dynamicAbsentCount = useMemo(() => {
    const totalEmployees = employees.length;
    if (totalEmployees === 0) return absentCount; // fallback
    return Math.max(0, totalEmployees - dynamicCheckInCount);
  }, [employees, dynamicCheckInCount, absentCount]);

  const dynamicAbsentDetails = useMemo(() => {
    if (employees.length === 0) return absentDetails;
    const presentEmpIds = new Set(dailySummaries.map((s: any) => s.employeeId || s.user?.employeeId || s.id));
    return employees.filter(e => !presentEmpIds.has(e.employeeId) && !presentEmpIds.has(e.id)).map(e => ({
      userName: e.name,
      date: getBDToday()
    }));
  }, [employees, dailySummaries, absentDetails]);

  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const calculateEarlyMinutes = (checkInIso: string | Date | null, shiftStartString: string | null) => {
    if (!checkInIso || !shiftStartString) return 0;
    
    try {
      // 1. Get the check-in time in local format ("HH:mm") safely using formatInTimeZone
      const bdTimeStr = formatInTimeZone(new Date(checkInIso), 'Asia/Dhaka', 'HH:mm');
      const [checkInHours, checkInMinutes] = bdTimeStr.split(':').map(Number);
      const totalCheckInMins = (checkInHours * 60) + checkInMinutes;

      // 2. Parse Shift Start Time (Assumes format "HH:mm" or "hh:mm A")
      const isPM = shiftStartString.toLowerCase().includes('pm');
      const timeParts = shiftStartString.replace(/am|pm/i, '').trim().split(':');
      let shiftHours = parseInt(timeParts[0], 10);
      const shiftMinutes = parseInt(timeParts[1], 10);

      if (isPM && shiftHours !== 12) shiftHours += 12;
      if (!isPM && shiftHours === 12) shiftHours = 0; // Midnight edge case

      const totalShiftMins = (shiftHours * 60) + shiftMinutes;

      // 3. Calculate difference
      const diff = totalShiftMins - totalCheckInMins;
      
      // Only return early minutes if they arrived at least 1 minute early
      return diff > 0 ? diff : 0;
    } catch (error) {
      console.error("Early calculation error:", error);
      return 0;
    }
  };

  const isAdminUser = ['admin', 'super admin', 'system administrator', 'hrm manager'].includes(
    (typeof user?.designation === 'object' ? (user?.designation as any)?.name : user?.designation)?.toLowerCase()
  ) || user?.roles?.some((r: any) => ['admin', 'super admin', 'system administrator', 'hrm manager'].includes((r?.name || r)?.toLowerCase()));
  
  const canCreateAll = isAdminUser || checkPermission(user, 'Attendance', 'create');
  // canViewAll: only admins or users with explicit 'all' read scope should see all employees' attendance
  const attendanceReadScope = getPermissionScopeSync(user, 'Attendance', 'read');
  const canViewAll = isAdminUser || attendanceReadScope === 'all';

  const [manualEntry, setManualEntry] = useState({
    employeeId: user?.employeeId || user?.id || '',
    punchType: 'CheckIn',
    date: getBDToday(),
    timestamp: getBDNowLocal()
  });
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const dateRange = searchParams?.get('range') || 'all-time';
  const customStartDate = searchParams?.get('startDate') || getBDToday();
  const customEndDate = searchParams?.get('endDate') || getBDToday();
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 30);
      }
    }, { threshold: 0.1 });

    const target = document.getElementById('infinite-scroll-trigger');
    if (target) observer.observe(target);

    return () => observer.disconnect();
  }, [loading]);

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
      const logsArray = Array.isArray(data) ? data : (data?.data || data?.logs || []);
      const summariesArray = Array.isArray(data?.summaries) ? data.summaries : [];
      console.log("🚀 DATA RECEIVED IN FRONTEND:", { logs: logsArray, summaries: summariesArray, raw: data });
      
      setLogs(logsArray);
      setServerSummaries(summariesArray);
      setTotalLogs(data?.total ?? logsArray.length);

      const calculatedCheckIns = logsArray.filter((log: any) => log.checkInTime !== null).length;
      const calculatedCheckOuts = logsArray.filter((log: any) => log.checkOutTime !== null && log.checkOutTime !== undefined).length;
      setCheckInCount(calculatedCheckIns);
      setCheckOutCount(calculatedCheckOuts);
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

  if (moduleConfig?.isAttendanceEnabled === false) return null;

  useEffect(() => {
    fetchLogs();
  }, [dateRange, customStartDate, customEndDate, departmentFilter]);

  const updateManualEntryForEmployee = (empId: string, customDate?: string) => {
    let calculatedPunchType = 'CheckIn';
    const targetDate = customDate || manualEntry.date || getBDToday();
    if (empId && logs) {
      const userLogsToday = logs.filter(log => {
        const logDate = toBDDisplay(log.timestamp, 'yyyy-MM-dd');
        return (String(log.employeeId) === String(empId) || String(log.user?.employeeId) === String(empId)) && logDate === targetDate;
      });

      userLogsToday.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastAction = userLogsToday[0];

      if (lastAction && (lastAction.punchType === 'CheckIn' || lastAction.punchType?.toLowerCase().includes('in')) && !lastAction.checkOutTime && !lastAction.checkOut) {
        calculatedPunchType = 'CheckOut';
      }
    }

    setManualEntry(prev => ({
      ...prev,
      employeeId: empId,
      punchType: calculatedPunchType,
      date: targetDate,
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

    // Polling every 5s as a fallback (Socket.IO is the primary real-time path)
    const intervalId = setInterval(() => {
      fetchLogs(true);
    }, 5000);

    // Socket.IO: instant table refresh when any punch or sync fires
    socket.on('attendanceUpdate', () => {
      fetchLogs(true);
    });
    socket.on('new-attendance', () => {
      fetchLogs(true);
    });

    return () => {
      clearInterval(intervalId);
      socket.off('attendanceUpdate');
      socket.off('new-attendance');
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
        await api.post('/attendance/manual', { employeeId: manualEntry.employeeId, punchType: manualEntry.punchType, locationAddress: 'Admin Manual Entry', date: manualEntry.date, isOverride: isOverrideMode });
        toast.success(t('manual_entry_success') || 'Manual entry added successfully');
        setIsModalOpen(false);
        fetchLogs();
        socket.emit('new-attendance');
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
          await api.post('/attendance/manual', { employeeId: manualEntry.employeeId, punchType: manualEntry.punchType, latitude, longitude, date: manualEntry.date, isOverride: isOverrideMode });
          toast.dismiss('geo-fetch');
          toast.success(t('manual_entry_success') || 'Manual entry added successfully');
          setIsModalOpen(false);
          fetchLogs();
          socket.emit('new-attendance');
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
          api.post('/attendance/manual', { employeeId: manualEntry.employeeId, punchType: manualEntry.punchType, locationAddress: 'Location Unavailable', date: manualEntry.date, isOverride: isOverrideMode })
            .then(() => {
               toast.success(t('manual_entry_success') || 'Manual entry added successfully (Fallback)');
               setIsModalOpen(false);
               fetchLogs();
               socket.emit('new-attendance');
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
      {/* ================= HEADER START ================= */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        
        {/* --- LEFT SIDE: Title Area --- */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('attendanceLogs') || 'Attendance Logs'}
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {t('live') || 'LIVE'}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500">
            {filteredLogs.length} Total Attendance Logs
          </p>
        </div>

        {/* --- RIGHT SIDE: Action Buttons Group --- */}
        {/* CRITICAL: ALL 6 elements MUST be direct children of this exact div */}
        <div className="flex items-center gap-3">
          
          {/* 1. All Departments Dropdown */}
          {canViewAll && (
            <div className="w-[180px]">
              <CustomDropdown
                value={departmentFilter}
                onChange={(val) => setDepartmentFilter(val)}
                placeholder={departmentsLoading ? 'Loading...' : 'All Departments'}
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                ]}
                className="h-10 w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shrink-0 shadow-sm"
              />
            </div>
          )}

          {/* 1.5. All Employees Dropdown */}
          {canViewAll && (
            <div className="w-[180px]">
              <CustomDropdown
                value={selectedEmployeeId}
                onChange={(val) => setSelectedEmployeeId(val)}
                placeholder={'All Employees'}
                options={[
                  { value: '', label: 'All Employees' },
                  ...employees.map((emp) => ({ value: emp.employeeId, label: emp.name || emp.employeeId })),
                ]}
                className="h-10 w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shrink-0 shadow-sm"
              />
            </div>
          )}

          {/* 2. Today Date Picker */}
          <div className="w-[150px]">
            <DateRangePicker
              value={{ range: dateRange, start: customStartDate, end: customEndDate }}
              onChange={(val) => {
                const params = new URLSearchParams(searchParams?.toString() || '');
                if (val.range) params.set('range', val.range);
                if (val.start) params.set('startDate', val.start);
                if (val.end) params.set('endDate', val.end);
                router.push(`?${params.toString()}`, { scroll: false });
              }}
              disabled={syncing}
              className="h-10 w-full shrink-0 bg-white dark:bg-slate-800 shadow-sm"
            />
          </div>

          {/* 3. Export Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl shadow-sm transition-all border border-slate-200 dark:border-slate-700 font-medium disabled:opacity-50"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : <Download className="w-4 h-4 shrink-0" />}
              {isExporting ? 'Exporting...' : t('export') || 'Export'}
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

          {/* 4. Sync Data Button */}
          {isAdminUser && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 font-medium shadow-sm shrink-0"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
              {syncing ? 'Syncing Live...' : (t('sync_data') || 'Sync Data')}
            </button>
          )}

          {/* 5. Filter Icon Button */}
          <button
            onClick={() => setIsCustomizeOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
            title="Customize Layout"
          >
            <Settings2 className="w-4 h-4 shrink-0" />
          </button>
          
          {/* 6. Manual Punch Button */}
          <button
            onClick={handleOpenModal}
            className="flex h-10 items-center justify-center gap-2 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-700 font-medium whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4 shrink-0" /> {t('manualEntry') || 'Manual Punch'}
          </button>

        </div>
      </div>
      {/* ================= HEADER END ================= */}
 
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Total Check In</p>
            <div className="p-2 bg-emerald-500/10 rounded-lg"><LogIn className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {dynamicCheckInCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Total Check Out</p>
            <div className="p-2 bg-orange-500/10 rounded-lg"><LogOut className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {dynamicCheckOutCount}
          </p>
        </div>
        <div 
          onClick={() => { setMetricModalTitle('Total Manual Entry'); setMetricModalData(manualDetails); setMetricModalOpen(true); }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Total Manual Entry</p>
            <div className="p-2 bg-blue-500/10 rounded-lg"><Fingerprint className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {dynamicManualCount}
          </p>
        </div>
        <div 
          onClick={() => { setMetricModalTitle('Total Absent'); setMetricModalData(dynamicAbsentDetails); setMetricModalOpen(true); }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Total Absent</p>
            <div className="p-2 bg-red-500/10 rounded-lg"><UserX className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {dynamicAbsentCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Device Sync</p>
            <div className="p-2 bg-purple-500/10 rounded-lg"><RefreshCw className="w-4 h-4 text-purple-600 dark:text-purple-400" /></div>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className="text-lg font-bold text-slate-900 dark:text-white">Active</p>
          </div>
        </div>
      </div>
 
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
 
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input 
              type="text" 
              placeholder={t('search_id_name') || 'Search logs...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div id="pdf-export-content" className="w-full overflow-x-auto whitespace-nowrap scrollbar-hide bg-white dark:bg-slate-900 rounded-lg">
          <div className="w-full overflow-x-auto rounded-lg shadow-sm">
<table className="w-full text-left border-collapse min-w-max">
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
                <tr>
                  <td colSpan={6} className="px-6 py-8">
                    <div className="flex flex-col items-center justify-center min-h-[200px] text-slate-500 dark:text-slate-400">
                      <FileText className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                      <p className="text-lg font-medium">{t('noRecords') || 'No records found'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dailySummaries.slice(0, visibleCount).map((row: any) => (
                  <tr 
                    key={row.id} 
                    onClick={() => openDetails('attendance', row.id, row)}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {row?.employeeName && row?.employeeName !== 'Unmapped' ? (
                          <span className="text-slate-900 dark:text-white font-bold">{row.employeeName}</span>
                        ) : (
                          <span className="text-red-500 font-medium text-sm">
                            Unknown Employee (Device ID: {row?.employeeId || 'N/A'})
                          </span>
                        )}
                        <PunchSourceBadge record={row} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-gray-200">
                      <span className="font-semibold">{row.date}</span>
                    </td>
                    <td className="px-6 py-4">
                      {row.checkIn ? (
                        <div>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            {toBDDisplay(row.checkIn, 'hh:mm a')}
                          </span>
                          
                          {/* Early Arrival Badge */}
                          {calculateEarlyMinutes(row.checkIn, row.user?.shift?.startTime || row.user?.shiftStartTime || row.user?.customDepartment?.shiftStartTime || row.shiftStartTime || "10:00 AM") > 0 && (
                            <span className="block mt-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded w-max">
                              {calculateEarlyMinutes(row.checkIn, row.user?.shift?.startTime || row.user?.shiftStartTime || row.user?.customDepartment?.shiftStartTime || row.shiftStartTime || "10:00 AM")}m early
                            </span>
                          )}

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
                      {row.checkOut ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                            {toBDDisplay(row.checkOut, 'hh:mm a')}
                          </span>
                          {row.isAutoCheckout && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-white/20 uppercase tracking-wider">
                              Auto-Checkout
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/10">
                          {t('attendance.missingWorking' as any) || 'Missing / Working'}
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
          
          {/* Infinite Scroll Trigger */}
          {!loading && (
            <div id="infinite-scroll-trigger" className="h-10 w-full flex items-center justify-center py-4">
              {visibleCount < dailySummaries.length && (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              )}
            </div>
          )}
        </div>
      </div>
  
      {/* Header Customization Modal */}
      <HeaderCustomizationModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        currentOrder={headerOrder}
        onSave={handleSaveLayout}
      />

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('select_employee') || 'Select Employee'}</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                      <CustomDropdown
                        value={manualEntry.employeeId}
                        onChange={(val) => updateManualEntryForEmployee(val)}
                        placeholder={t('select_an_employee') || 'Select an employee...'}
                        options={[
                          ...(isAdminUser ? [{ value: '', label: t('select_an_employee') || 'Select an employee...' }] : []),
                          ...employees.map(emp => ({ value: emp.employeeId, label: `${emp.name} (ID: ${emp.employeeId})` })),
                          ...(!isAdminUser && !employees.find(e => e.employeeId === user?.employeeId) && user ? [{ value: user.employeeId, label: `${user.name} (ID: ${user.employeeId})` }] : [])
                        ]}
                        className="w-full bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('date') || 'Date'}</label>
                    <input 
                      type="date"
                      value={manualEntry.date}
                      onChange={(e) => updateManualEntryForEmployee(manualEntry.employeeId, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">{t('punchType') || 'Punch Type'}</label>
                  {!isOverrideMode ? (
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={manualEntry.punchType === 'CheckOut' ? "Check Out" : "Check In"}
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-500 font-semibold cursor-not-allowed text-sm"
                      />
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  ) : (
                    <select
                      value={manualEntry.punchType}
                      onChange={(e) => setManualEntry({ ...manualEntry, punchType: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="CheckIn">Check In</option>
                      <option value="CheckOut">Check Out</option>
                    </select>
                  )}
                  {isAdminUser && (
                    <div className="flex items-center gap-2 mt-2">
                      <input 
                        type="checkbox" 
                        id="overrideToggle" 
                        checked={isOverrideMode}
                        onChange={(e) => setIsOverrideMode(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor="overrideToggle" className="text-xs text-slate-500 font-medium cursor-pointer">
                        Override System Auto-Detection
                      </label>
                    </div>
                  )}
                  {!isOverrideMode && !isAdminUser && (
                    <p className="text-xs text-slate-500 mt-1">
                      System automatically determines the required punch type.
                    </p>
                  )}
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

                const parseLocal = (val: string) => {
                  if (!val) return null;
                  // The input gives 'YYYY-MM-DDTHH:mm'
                  // We explicitly extract the components and use the native Date constructor
                  // which strictly interprets the values in the browser's local timezone.
                  const [date, time] = val.split('T');
                  const [y, m, d] = date.split('-');
                  const [h, min] = time.split(':');
                  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)).toISOString();
                };

                await api.patch(`/attendance/${editingRecord.id}`, {
                  checkIn: parseLocal(checkInDate),
                  checkOut: parseLocal(checkOutDate)
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
                  defaultValue={editingRecord.checkInRaw ? getLocalDatetimeLocal(editingRecord.checkInRaw) : ''}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-650 dark:text-gray-400">Check Out Time</label>
                <input 
                  type="datetime-local" 
                  name="checkOut"
                  defaultValue={editingRecord.checkOutRaw ? getLocalDatetimeLocal(editingRecord.checkOutRaw) : ''}
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

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>}>
      <AttendancePageContent />
    </Suspense>
  );
}

