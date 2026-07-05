"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { calculateWorkingHours } from "@/lib/timeUtils";
import {
  CalendarRange,
  RefreshCw,
  Clock,
  Megaphone,
  BarChart3,
  PieChart as PieChartIcon,
  UserMinus,
  Trash2,
  X,
  LogIn,
  LogOut,
  CalendarCheck2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "@/services/api";
import toast from "react-hot-toast";
import { useTranslation } from "@/context/LanguageContext";
import { toBDDisplay, getBDToday } from "@/lib/dateUtils";
import { io as socketIO } from "socket.io-client";
import { usePermissions } from "@/hooks/usePermissions";
import dynamic from 'next/dynamic';

const WeeklyChart = dynamic(() => import('@/components/charts/WeeklyChart'), { ssr: false });
const DepartmentChart = dynamic(() => import('@/components/charts/DepartmentChart'), { ssr: false });
const LateTodayWidget = dynamic(() => import('@/components/dashboard/LateTodayWidget'), { ssr: false });

// ─── Annual leave quota (company policy) ─────────────────────────────────────
const ANNUAL_LEAVE_QUOTA = 20;

const formatTimeAMPM = (time24: string) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

export default function DashboardOverview() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const [stats, setStats] = useState({
    employees: 0,
    pendingLeaves: 0,
    remainingLeaves: ANNUAL_LEAVE_QUOTA,
    activeNow: 0,
    totalToday: 0,
    totalAbsent: 0,
  });

  // For the "Today's Punch Status" card — track the user's latest punch
  const [latestPunch, setLatestPunch] = useState<{
    punchType: string;
    timestamp: string;
  } | null>(null);

  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [assignedShift, setAssignedShift] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getBDToday());

  // ── Derive admin status ────────────────────────────────────────────────────
  const isAdmin = [
    "Admin",
    "Super Admin",
    "System Administrator",
    "HR Manager",
  ].includes((user as any)?.designation || "");

  // ── Helpers ────────────────────────────────────────────────────────────────
  const deriveLatestPunch = (absoluteLatestRecord: any, logs: any[], currentUserId?: string) => {
    if (absoluteLatestRecord) {
      return { punchType: absoluteLatestRecord.punchType, timestamp: absoluteLatestRecord.timestamp, id: absoluteLatestRecord.id, checkOut: absoluteLatestRecord.checkOut };
    }
    
    if (!currentUserId) return null;
    const myLogs = logs.filter((l) => l.employeeId === currentUserId || l.id === currentUserId);
    if (myLogs.length === 0) return null;
    // logs are sorted desc by timestamp from the API
    return { punchType: myLogs[0].punchType, timestamp: myLogs[0].timestamp, id: myLogs[0].id, checkOut: myLogs[0].checkOut };
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    try {
      const [usersRes, leavesRes, presenceRes, announcementsRes, analyticsRes, deptsRes] =
        await Promise.all([
          api.get("/employees").catch(() => ({ data: [] })),
          api.get("/leaves/all").catch(() => ({ data: [] })),
          api
            .get(`/attendance/active-today?date=${selectedDate}`)
            .catch(() => ({
              data: { activeNow: 0, totalToday: 0, recent: [], recentAll: [] },
            })),
          api.get("/announcements").catch(() => ({ data: [] })),
          api.get("/dashboard/analytics").catch(() => ({ data: [] })),
          api.get("/team/departments").catch(() => ({ data: [] })),
        ]);

      setAnnouncements(announcementsRes.data || []);
      setWeeklyAnalytics(analyticsRes.data || []);

      const allUsers = usersRes.data.data || usersRes.data || [];
      const deptCounts = allUsers.reduce((acc: any, u: any) => {
        if (!u.isActive || u.employeeId === "UNMAPPED_FALLBACK") return acc;
        const dept = u.department || "Unassigned";
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {});
      setDepartmentData(
        Object.keys(deptCounts).map((key) => ({
          name: key,
          value: deptCounts[key],
        }))
      );

      // Fetch Shift Info
      if (user?.id) {
        const currentUserData = allUsers.find((u: any) => u.id === user.id || u.employeeId === user.employeeId) || user;
        
        if (currentUserData) {
          const shiftStart = 
            (currentUserData as any)?.shift?.startTime || 
            (currentUserData as any)?.shiftStartTime || 
            (currentUserData as any)?.customDepartment?.shiftStartTime;
          
          const shiftEnd = 
            (currentUserData as any)?.shift?.endTime || 
            (currentUserData as any)?.shiftEndTime || 
            (currentUserData as any)?.customDepartment?.shiftEndTime;

          const formattedStart = shiftStart ? (shiftStart.includes('AM') || shiftStart.includes('PM') ? shiftStart : formatTimeAMPM(shiftStart)) : null;
          const formattedEnd = shiftEnd ? (shiftEnd.includes('AM') || shiftEnd.includes('PM') ? shiftEnd : formatTimeAMPM(shiftEnd)) : null;
          
          setAssignedShift(formattedStart && formattedEnd ? { start: formattedStart, end: formattedEnd } : null);
        } else {
          setAssignedShift(null);
        }
      }


      const employeeCount = isAdmin
        ? usersRes.data.totalCount ||
          usersRes.data.data?.length ||
          usersRes.data.length ||
          0
        : 1;
      const presentCount = presenceRes.data.activeNow || 0;

      // Calculate remaining leaves for the current user
      const allLeaves: any[] = leavesRes.data || [];
      const myApprovedLeaves = isAdmin
        ? []
        : allLeaves.filter(
            (l: any) =>
              (l.employeeId === user?.id || l.userId === user?.id) &&
              l.status === "Approved"
          );
      const takenDays = isAdmin
        ? 0
        : myApprovedLeaves.reduce(
            (sum: number, l: any) => sum + (l.totalDays || 1),
            0
          );
      const remainingLeaves = Math.max(0, ANNUAL_LEAVE_QUOTA - takenDays);

      setStats({
        employees: employeeCount,
        pendingLeaves:
          allLeaves.filter((l: any) => l.status === "Pending").length || 0,
        remainingLeaves,
        activeNow: presentCount,
        totalToday: presenceRes.data.totalToday || 0,
        totalAbsent: presenceRes.data.totalAbsent ?? Math.max(0, employeeCount - presentCount),
      });

      const allLogs = presenceRes.data.recentAll || presenceRes.data.recent || [];
      setRecentAttendance(allLogs);

      // Derive the current user's latest punch globally (Cross-Midnight bug fix)
      if (!isAdmin && user?.id) {
        setLatestPunch(deriveLatestPunch(presenceRes.data.myAbsoluteLatest, allLogs, user.id));
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  const pollLiveActivity = async () => {
    try {
      const res = await api.get(
        `/attendance/active-today?date=${selectedDate}&_t=${Date.now()}`
      );
      setStats((prev) => ({
        ...prev,
        activeNow: res.data.activeNow || 0,
        totalToday: res.data.totalToday || 0,
        totalAbsent: res.data.totalAbsent ?? Math.max(0, prev.employees - (res.data.activeNow || 0)),
      }));
      const allLogs = res.data.recentAll || res.data.recent || [];
      setRecentAttendance(allLogs);
      if (!isAdmin && user?.id) {
        setLatestPunch(deriveLatestPunch(null, allLogs, user.id));
      }
    } catch (e) {
      console.error("Live polling failed:", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      const intervalId = setInterval(() => {
        pollLiveActivity();
      }, 30000);

      const socket = socketIO({
        path: "/socket.io",
        transports: ["websocket", "polling"],
      });
      socket.on("attendanceUpdate", () => pollLiveActivity());
      socket.on("new-attendance", () => pollLiveActivity());

      return () => {
        clearInterval(intervalId);
        socket.disconnect();
      };
    }
  }, [user, selectedDate]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await api.post("/attendance/sync-users");
      toast.success("Device sync complete!");
    } catch (e: any) {
      console.warn("Device sync skipped/failed:", e.message);
    }
    await pollLiveActivity();
    toast.success("Latest data loaded from database!");
    setSyncing(false);
  };

  const handleClearBoard = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear the entire notice board? This cannot be undone."
      )
    )
      return;
    try {
      await api.delete("/announcements");
      setAnnouncements([]);
      toast.success("Notice board cleared");
    } catch {
      toast.error("Failed to clear board");
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await api.delete(`/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Announcement deleted");
    } catch {
      toast.error("Failed to delete announcement");
    }
  };

  // ── Punch status card helpers ──────────────────────────────────────────────
  const getPunchStatus = () => {
    if (!recentAttendance || recentAttendance.length === 0) return { label: "Not Punched In", isIn: false, isYesterday: false };
    
    const myPunches = recentAttendance.filter((l: any) => l.employeeId === user?.id || l.employeeId === user?.employeeId);
    if (myPunches.length === 0) return { label: "Not Punched In", isIn: false, isYesterday: false };

    // API returns logs sorted desc by timestamp
    const absoluteLatest = myPunches[0];
    const isYesterday = new Date(absoluteLatest.timestamp).toDateString() !== new Date().toDateString();

    // If ODD number of punches today, the last punch was a Check In
    if (myPunches.length % 2 !== 0) {
      return { 
        label: isYesterday ? "Ongoing (Yesterday)" : "🟢 Punched In", 
        isIn: true,
        isYesterday
      };
    }
    
    // If EVEN (and > 0), the last punch was a Check Out
    return { label: "🟠 Punched Out", isIn: false, isYesterday: false };
  };

  const todayWorkingHours = useMemo(() => {
    if (isAdmin || !user?.id || recentAttendance.length === 0) return null;
    const myPunches = recentAttendance.filter((l: any) => l.employeeId === user.id || l.employeeId === user.employeeId);
    if (myPunches.length === 0) return "0h 0m";
    
    const sorted = [...myPunches].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const checkIns = sorted.filter(p => p.punchType?.toLowerCase().includes("in"));
    const checkOuts = sorted.filter(p => p.punchType?.toLowerCase().includes("out"));
    
    if (checkIns.length === 0) return "0h 0m";
    const earliestCheckIn = checkIns[0].timestamp;
    const latestCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].timestamp : null;
    
    return calculateWorkingHours(earliestCheckIn, latestCheckOut);
  }, [recentAttendance, user, isAdmin]);

  // ── Weekly chart: filter out Sunday ───────────────────────────────────────
  const chartData = weeklyAnalytics.filter(
    (d: any) => d.date?.toLowerCase() !== "sun"
  );

  const COLORS = [
    "#8b5cf6",
    "#06b6d4",
    "#f59e0b",
    "#10b981",
    "#f43f5e",
    "#6366f1",
  ];

  const punchStatus = getPunchStatus();


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-6">

      {/* ─── Sync Button Row ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            {isAdmin ? "Admin Dashboard" : "My Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 font-medium shadow-md shadow-indigo-500/10"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          Sync Data
        </button>
      </div>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Today's Punch Status (Employee) / Present Now (Admin) */}
        {can("Attendance", "canRead") && (
          <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-md">
            <div className="flex items-start justify-between w-full">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  {isAdmin ? t("presentNow") : "Today's Punch Status"}
                </p>
                {isAdmin ? (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${stats.activeNow > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">
                      {loading ? "-" : stats.activeNow}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    {loading ? (
                      <p className="text-lg font-bold text-slate-400">—</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${latestPunch ? (punchStatus.isIn ? "bg-emerald-500 animate-pulse" : "bg-orange-400") : "bg-slate-300"}`} />
                        <p className={`text-sm font-bold leading-tight ${punchStatus.isIn ? "text-emerald-600 dark:text-emerald-400" : latestPunch ? "text-orange-500 dark:text-orange-400" : "text-slate-500 dark:text-gray-400"}`}>
                          {punchStatus.label}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-xl flex-shrink-0 ${punchStatus.isIn || (isAdmin && stats.activeNow > 0) ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-100 dark:bg-white/5 text-slate-400"}`}>
                {punchStatus.isIn ? <LogIn className="w-5 h-5" /> : latestPunch ? <LogOut className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
            </div>

            {!isAdmin && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between w-full">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Shift</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {assignedShift ? (
                    `${assignedShift.start} - ${assignedShift.end}`
                  ) : (
                    <span className="text-slate-400 font-normal italic">Not Assigned</span>
                  )}
                </span>
              </div>
            )}
            
            {!isAdmin && todayWorkingHours && (
              <div className="mt-2 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Office Hour</span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {todayWorkingHours}
                  </span>
                </div>
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 flex-shrink-0 border border-indigo-500/20">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card 2: Absent Days */}
        {can("Attendance", "canRead") && (
          <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between hover:border-orange-500/50 transition-all shadow-sm dark:shadow-md">
            <div>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                {isAdmin ? "Total Absent" : "Absent Days"}
              </p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">
                {loading ? "-" : stats.totalAbsent}
              </p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-xl text-orange-500 dark:text-orange-400 flex-shrink-0">
              <UserMinus className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* Card 3: Pending Leaves (admin) / Remaining Leaves (employee) */}
        {can("Leaves", "canRead") && (
          <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between hover:border-purple-500/50 transition-all shadow-sm dark:shadow-md">
            <div>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                {isAdmin ? t("pendingLeaves") : "Remaining Leaves"}
              </p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">
                {loading ? "-" : isAdmin ? stats.pendingLeaves : stats.remainingLeaves}
              </p>
              {!isAdmin && !loading && (
                <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">
                  of {ANNUAL_LEAVE_QUOTA} days/year
                </p>
              )}
            </div>
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-500 dark:text-purple-400 flex-shrink-0">
              <CalendarRange className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* Card 4: Pending Leaves for employees (separate from remaining) */}
        {!isAdmin && can("Leaves", "canRead") && (
          <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between hover:border-sky-500/50 transition-all shadow-sm dark:shadow-md">
            <div>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Pending Leaves
              </p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">
                {loading ? "-" : stats.pendingLeaves}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">awaiting approval</p>
            </div>
            <div className="p-3 bg-sky-500/20 rounded-xl text-sky-500 dark:text-sky-400 flex-shrink-0">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Notice Board */}
          {can("Announcements", "canRead") && announcements.length > 0 && (
            <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/20 rounded-3xl p-6 shadow-md dark:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Notice Board
                  </h3>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleClearBoard}
                    className="text-xs flex items-center gap-1 font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Clear All
                  </button>
                )}
              </div>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {announcements.map((notice) => {
                  const isNew =
                    new Date().getTime() -
                      new Date(notice.createdAt).getTime() <
                    24 * 60 * 60 * 1000;
                  return (
                    <div
                      key={notice.id}
                      className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 relative group"
                    >
                      {isNew && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">
                          NEW
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteNotice(notice.id)}
                          className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Announcement"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm md:text-base pr-6">
                        {notice.title}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm mt-1 whitespace-pre-wrap">
                        {notice.message}
                      </p>
                      <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>By {notice.author?.name || "Admin"}</span>
                        <span>{toBDDisplay(notice.createdAt, "MMM dd, hh:mm a")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My Punches / Live Activity Feed */}
          {can("Attendance", "canRead") && (
            <div className="w-full">
              <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {isAdmin ? t("liveActivity") : "My Punches"}
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 w-full sm:w-auto">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) =>
                          setSelectedDate(e.target.value || getBDToday())
                        }
                        className="bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none cursor-pointer font-medium w-full sm:w-32"
                        title="Select date to view punches"
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-bold px-2 py-1.5 bg-emerald-500/10 rounded-lg w-full sm:w-auto text-center">
                      {selectedDate === getBDToday() ? t("realTime") : "Historical"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  {loading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse"
                        >
                          <div className="flex flex-col gap-2 w-[70%]">
                            <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-3 w-32 bg-slate-300 dark:bg-slate-600 rounded" />
                            <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                          </div>
                          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
                        </div>
                      ))}
                    </div>
                  ) : recentAttendance.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 gap-2 opacity-50 py-8">
                      <Clock className="w-8 h-8" />
                      <p className="text-sm italic">{t("waitingForPunches")}</p>
                    </div>
                  ) : (
                    recentAttendance.map((log, i) => {
                      const isCheckIn = log.punchType?.toLowerCase().includes("in");
                      return (
                        <div
                          key={log.id || i}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 animate-in slide-in-from-right-4 duration-300"
                        >
                          <div className="flex flex-col gap-1 min-w-0 max-w-[75%]">
                            <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono truncate block">
                              {log.employeeId}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                                {log.employeeName || "Unknown Employee"}
                              </span>
                              {isCheckIn && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {toBDDisplay(log.timestamp, "hh:mm a")}
                            </span>
                          </div>
                          <div
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md border shrink-0 ${
                              isCheckIn
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                            }`}
                          >
                            {isCheckIn
                              ? t("checkIn") || "Check In"
                              : t("checkOut") || "Check Out"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Analytics */}
        <div className="lg:col-span-1 space-y-6">

          {/* My Weekly Attendance Chart — Sunday excluded */}
          {can("Attendance", "canRead") && (
            <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-brand-primary/20 rounded-lg text-brand-primary">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {isAdmin ? "Weekly Attendance" : "My Weekly Attendance"}
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">Mon – Sat (Sun excluded)</p>
                </div>
              </div>
              <div className="w-full relative">
                {loading ? (
                  <div className="h-72 flex items-center justify-center min-h-[300px]">
                    <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-slate-400 text-sm min-h-[300px]">
                    No data available
                  </div>
                ) : (
                  <WeeklyChart chartData={chartData} />
                )}
              </div>
            </div>
          )}

          {/* Department Distribution — admin only */}
          {isAdmin && (
            <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-md dark:shadow-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
                  <PieChartIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Department Overview
                </h3>
              </div>
              <div className="w-full relative">
                {loading ? (
                  <div className="h-72 flex items-center justify-center min-h-[300px]">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : departmentData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-slate-400 text-sm min-h-[300px]">
                    No data available
                  </div>
                ) : (
                  <DepartmentChart departmentData={departmentData} COLORS={COLORS} totalEmployees={stats.employees} />
                )}
              </div>
            </div>
          )}

          {/* Late Today Widget — admin only */}
          {isAdmin && (
            <div className="h-96 w-full">
              <LateTodayWidget />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
