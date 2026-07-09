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
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { WidgetMap } from "@/components/dashboard/widgets/DashboardWidgets";

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


  const widgetData = {
    isAdmin, stats, loading, punchStatus, latestPunch, assignedShift, todayWorkingHours,
    ANNUAL_LEAVE_QUOTA, announcements, handleClearBoard, handleDeleteNotice,
    selectedDate, setSelectedDate, recentAttendance, chartData, departmentData, COLORS, t
  };

  const { layout, isLoaded, handleDragEnd } = useDashboardLayout(isAdmin);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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

        {/* ─── Summary Zone (Top) ─── */}
        <Droppable direction="horizontal" droppableId="summaryZone">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
            >
              {layout.summaryZone.map((id, index) => {
                const Widget = WidgetMap[id];
                if (!Widget) return null;
                return (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`col-span-1 transition-transform ${snapshot.isDragging ? "z-50 scale-105 shadow-xl" : ""}`}
                        style={{ ...provided.draggableProps.style }}
                      >
                        <Widget isCompact={true} data={widgetData} />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* ─── Detail Zone (Bottom) ─── */}
        <Droppable direction="vertical" droppableId="detailZone">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {layout.detailZone.map((id, index) => {
                const Widget = WidgetMap[id];
                if (!Widget) return null;
                // Specific sizing rules for detail widgets
                let colSpanClass = "col-span-full md:col-span-1";
                if (id === 'notice-board' || id === 'my-punches') {
                   colSpanClass = "col-span-full";
                }
                
                return (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`${colSpanClass} transition-transform ${snapshot.isDragging ? "z-50 scale-[1.02] shadow-xl" : ""}`}
                        style={{ ...provided.draggableProps.style }}
                      >
                        <Widget isCompact={false} data={widgetData} />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

      </div>
    </DragDropContext>
  );
}
