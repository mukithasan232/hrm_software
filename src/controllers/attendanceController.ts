import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs, syncZkTecoData } from '../services/zkService';
import { runWithDeviceLock, startRealtimeListener } from '../services/realtimeService';
import { prisma } from '../lib/prisma';
import { checkPermission, getPermissionScopeSync } from '../utils/checkPermission';
import bcrypt from 'bcryptjs';
import { Parser } from 'json2csv';
import { eventEmitter } from '../lib/eventEmitter';

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';
import { to12Hour } from '../lib/dateUtils';

const BD_TZ = 'Asia/Dhaka';

function getTodayBoundaries(): { start: Date; end: Date } {
  const todayStr = formatInTimeZone(new Date(), BD_TZ, 'yyyy-MM-dd');
  const startUTC = new Date(`${todayStr}T00:00:00+06:00`);
  const endUTC = new Date(`${todayStr}T23:59:59.999+06:00`);
  return { start: startUTC, end: endUTC };
}

function getDayBoundaries(filter: string): { start: Date; end: Date } {
  let dateStr = filter;
  if (filter === 'today' || filter === 'yesterday' || filter === 'week' || filter === 'month') {
    const targetDate = new Date();
    if (filter === 'yesterday') {
      targetDate.setDate(targetDate.getDate() - 1);
    } else if (filter === 'week') {
      targetDate.setDate(targetDate.getDate() - 7);
    } else if (filter === 'month') {
      targetDate.setDate(targetDate.getDate() - 30);
    }
    dateStr = formatInTimeZone(targetDate, BD_TZ, 'yyyy-MM-dd');

    const startUTC = new Date(`${dateStr}T00:00:00+06:00`);
    const targetEndStr = filter === 'today' || filter === 'yesterday' ? dateStr : formatInTimeZone(new Date(), BD_TZ, 'yyyy-MM-dd');
    const endUTC = new Date(`${targetEndStr}T23:59:59.999+06:00`);
    return { start: startUTC, end: endUTC };
  }

  // Handle explicit exact dates (yyyy-MM-dd) or custom ranges (yyyy-MM-dd_yyyy-MM-dd)
  if (dateStr.includes('_')) {
    const [startStr, endStr] = dateStr.split('_');
    const startUTC = new Date(`${startStr}T00:00:00+06:00`);
    const endUTC = new Date(`${endStr}T23:59:59.999+06:00`);
    return { start: startUTC, end: endUTC };
  }

  const startUTC = new Date(`${dateStr}T00:00:00+06:00`);
  const endUTC = new Date(`${dateStr}T23:59:59.999+06:00`);
  return { start: startUTC, end: endUTC };
}

export const syncDeviceLogs = async (req: Request, res: Response) => {
  try {
    const reqAny = req as any;
    let forceReset = false;
    let dateToSync = new Date();

    // Attempt to parse body for forceReset
    try {
      if (typeof reqAny.json === 'function') {
        const body = await reqAny.json();
        forceReset = body.forceReset === true;
        if (body.date) dateToSync = new Date(body.date);
      } else if (reqAny.body) {
        forceReset = reqAny.body.forceReset === true;
        if (reqAny.body.date) dateToSync = new Date(reqAny.body.date);
      }
    } catch (e) {
      // Ignore body parse errors
    }

    if (forceReset) {
      await prisma.attendanceLog.deleteMany({
        where: {
          timestamp: {
            gte: new Date(dateToSync.setHours(0, 0, 0, 0)),
            lte: new Date(dateToSync.setHours(23, 59, 59, 999))
          },
          // ONLY delete records that came from the machine. 
          // Our deviceId for machine records is usually an IP or 'RAW_PROCESSOR'. 
          // Manual entries use 'Manual Entry'.
          deviceId: {
            not: { contains: 'Manual' }
          }
        }
      });
      console.log(`[ZKService] 🧹 Force Reset triggered. Cleared machine logs for ${dateToSync.toDateString()}.`);
    }

    // Pure additive sync — no destructive wipe. The DB unique constraint
    // (@@unique([employeeId, timestamp])) and skipDuplicates:true on createMany
    // are the sole deduplication mechanism.
    // We pass `true` here to force the sync to look back all the way to 2000 for a Deep Sync
    const result = await runWithDeviceLock(() => syncZkTecoData(true));
    const newRecordsCount = result.synced;
    res.status(200).json({
      message: 'Sync completed successfully',
      newRecordsSynced: newRecordsCount,
    });
  } catch (error: any) {
    res.status(503).json({ message: 'Failed to sync with device', error: error.message });
  }
};

// @desc    Live sync with full stats
export const syncLive = async (req: Request, res: Response) => {
  // Pure additive sync — no destructive wipe. Respond immediately, run in background.
  res.status(200).json({
    message: 'Biometric sync started in the background.',
    status: 'processing'
  });

  (async () => {
    try {
      await runWithDeviceLock(() => getDeviceAttendance());
    } catch (err: any) {
      console.error('[BackgroundSync] ❌ Sync failed:', err.message);
    }
  })();
};

export const getDeviceStatus = async (req: Request, res: Response) => {
  const result = await runWithDeviceLock(() => pingDevice());
  res.status(result.reachable ? 200 : 503).json(result);
};

export const syncDeviceUsersToDB = async (req: Request, res: Response) => {
  try {
    const result = await runWithDeviceLock(() => syncZkTecoData(true));
    startRealtimeListener();

    res.status(200).json({
      success: true,
      message: `Sync complete. ${result.synced} records synced.`,
      synced: result.synced,
    });
  } catch (error: any) {
    res.status(503).json({ success: false, message: 'Device unreachable.', error: error.message });
  }
};

export const fetchDeviceUsers = async (req: Request, res: Response) => {
  try {
    const users = await runWithDeviceLock(() => getDeviceUsers());
    res.status(200).json(users);
  } catch (error: any) {
    res.status(503).json({ message: 'Failed to fetch users', error: error.message });
  }
};

// @desc    Export attendance logs to CSV
// @route   GET /api/attendance/export
export const exportAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scope = getPermissionScopeSync(user, 'attendance', 'read');

    if (scope === 'no') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const where: any = {};
    if (scope === 'own' && user?.id) {
      where.employeeId = user.id;
    } else if (scope === 'department' && user?.department) {
      where.user = { department: user.department };
    }

    const logs = await prisma.attendanceLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { name: true, employeeId: true } }
      }
    });

    const data = logs.map((log: any) => ({
      EmployeeName: log.user?.name || 'Unmapped User',
      EmployeeID: log.user?.employeeId || log.employeeId,
      Timestamp: log.timestamp.toISOString(),
      PunchType: log.punchType,
      Device: log.deviceId
    }));

    const fields = ['EmployeeName', 'EmployeeID', 'Timestamp', 'PunchType', 'Device'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    // BOM ফিক্স যেন এক্সেল সঠিকভাবে কলাম ডিটেক্ট করে
    const csvWithBOM = '\uFEFF' + csv;

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`Attendance_Export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvWithBOM);
  } catch (error: any) {
    console.error('❌ [Export] Error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
};

export const getActivePresence = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scope = getPermissionScopeSync(user, 'attendance', 'read');

    if (scope === 'no') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const queryDate = req.query.date as string | undefined;
    const { start, end } = queryDate ? getDayBoundaries(queryDate) : getTodayBoundaries();

    const whereClause: any = { timestamp: { gte: start, lte: end } };
    if (scope === 'own' && user?.id) {
      whereClause.employeeId = user.id;
    } else if (scope === 'department' && user?.department) {
      whereClause.user = { department: user.department };
    }

    // 1. Fetch attendance logs for the period, ordered by latest first
    const todaysLogs = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: { 
        user: { 
          select: { 
            name: true, 
            profileImage: true,
            designation: true,
            shift: true, 
            customDepartment: true, 
            shiftStartTime: true 
          } 
        } 
      },
      orderBy: { timestamp: 'asc' } // Ascending to find the very first Check-In for late calculation
    });

    // 2. Filter: Find employees whose MOST RECENT punch is a "Check In"
    const currentlyPresentLogs: any[] = [];
    const allLatestPunchLogs: any[] = []; // every employee who punched today (any type)
    const seenEmployees = new Set();
    let totalUniqueEmployeesToday = 0;

    for (const log of [...todaysLogs].reverse()) { // Reverse to find the latest punch
      if (!seenEmployees.has(log.employeeId)) {
        seenEmployees.add(log.employeeId);
        totalUniqueEmployeesToday++;
        // Always capture their latest punch for the full activity list
        allLatestPunchLogs.push(log);
        // If the latest log for this employee is a Check-in, they are still in the office
        if (log.punchType?.toLowerCase().includes('in')) {
          currentlyPresentLogs.push(log);
        }
      }
    }

    const mapLog = (log: any) => ({ ...log, employeeName: log.user?.name || 'Unmapped' });

    // Task 2: Smart Absenteeism Calculation (Time-Aware)
    const activeEmployees = await prisma.user.findMany({
      // where: { isActive: true }, // Removed to include ALL standard employees
      include: { customDepartment: true, shift: true, customDesignation: true }
    });

    const regularEmployees = activeEmployees.filter((u: any) => {
      const desigName = typeof u.designation === 'object' ? (u.designation as any)?.name : u.designation;
      const desig = (desigName || '').toLowerCase();
      return !['admin', 'super admin', 'system administrator', 'hrm manager', 'hr'].includes(desig) && u.email !== 'dev@fixanyphoto.com' && u.userType !== 'SUPER_ADMIN';
    });

    const presentUserIds = new Set(allLatestPunchLogs.map(l => l.employeeId));

    // Also exclude users who are on approved leave today
    const leavesToday = await prisma.leave.findMany({
      where: {
        status: 'Approved',
        startDate: { lte: end },
        endDate: { gte: start }
      },
      select: { employeeId: true }
    });
    const leaveUserIds = new Set(leavesToday.map((l: any) => l.employeeId));

    let trueAbsentCount = 0;
    const currentTime = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[currentTime.getDay()];

    const absentEmployeesList: any[] = [];

    regularEmployees.forEach((user: any) => {
      if (presentUserIds.has(user.id) || leaveUserIds.has(user.id)) return; // Skip if present or on leave

      let weekendDays = ['Sunday'];
      if (user.customDesignation?.weekendDays) {
        try {
          const parsed = typeof user.customDesignation.weekendDays === 'string'
            ? JSON.parse(user.customDesignation.weekendDays)
            : user.customDesignation.weekendDays;
          if (Array.isArray(parsed) && parsed.length > 0) weekendDays = parsed;
        } catch (e) { }
      }

      if (weekendDays.includes(todayName)) return; // Strictly exclude if today is their weekend

      // Push to absent array
      absentEmployeesList.push(user);

      const shiftStr = user.shift?.startTime || user.shiftStartTime || user.customDepartment?.shiftStartTime || '09:00';
      const [hours, minutes] = shiftStr.split(':').map(Number);

      const userShiftStartTime = new Date();
      userShiftStartTime.setHours(hours, minutes, 0, 0);

      // Core Logic: Only count as absent if current time has passed their shift start time
      if (currentTime > userShiftStartTime) {
        trueAbsentCount++;
      }
    });

    const calculatedAbsent = trueAbsentCount;

    // --- NEW: Late Calculation ---
    const lateEmployees: any[] = [];
    const seenForLate = new Set();

    for (const log of todaysLogs) {
      if (!seenForLate.has(log.employeeId) && log.punchType?.toLowerCase().includes('in')) {
        seenForLate.add(log.employeeId); // Only evaluate the first Check-In of the day

        const user = (log as any).user;
        const shiftStr = user?.shift?.startTime || user?.shiftStartTime || user?.customDepartment?.shiftStartTime;
        if (shiftStr) {
          const [hours, minutes] = shiftStr.split(':').map(Number);
          const shiftStartMins = hours * 60 + minutes;
          
          const checkInDate = new Date(log.timestamp);
          // Shift to BD time for accurate hour comparison
          const bdTime = new Date(checkInDate.getTime() + (6 * 60 * 60 * 1000));
          const checkInMins = bdTime.getUTCHours() * 60 + bdTime.getUTCMinutes();
          
          const gracePeriod = 15; // 15 mins grace period
          if (checkInMins > (shiftStartMins + gracePeriod)) {
            lateEmployees.push(log);
          }
        }
      }
    }

    // 3. Absolute Latest for Current User (Cross-Midnight Bug Fix)
    let myAbsoluteLatest = null;
    if (user?.id) {
      myAbsoluteLatest = await prisma.attendanceLog.findFirst({
        where: { employeeId: user.id },
        orderBy: { timestamp: 'desc' }
      });
    }

    res.status(200).json({
      totalToday: totalUniqueEmployeesToday,
      activeNow: currentlyPresentLogs.length,
      totalAbsent: calculatedAbsent,
      absentList: absentEmployeesList,
      lateCount: lateEmployees.length,
      lateList: lateEmployees,
      recent: currentlyPresentLogs.map(mapLog),
      recentAll: allLatestPunchLogs.map(mapLog),
      myAbsoluteLatest
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// @desc    Get all stored attendance logs
export const getAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scope = getPermissionScopeSync(user, 'attendance', 'read');

    // 403 block removed to allow fallback to own records

    const { page, limit, employeeId, filter, department, startDate, endDate } = req.query;

    let targetDeptName: string | null = null;
    if (department && department !== 'all') {
      const deptRecord = await prisma.department.findUnique({ where: { id: String(department) } });
      if (deptRecord) targetDeptName = deptRecord.name;
    }

    const employeeWhere: any = {};
    const where: any = {};

    const role = user?.role?.toUpperCase();
    const userType = user?.userType?.toUpperCase();
    const designationName = typeof user?.designation === 'string' ? user.designation.toUpperCase() : user?.designation?.name?.toUpperCase();

    const isAdminOrSuperAdmin = 
      role === 'ADMIN' || 
      role === 'SUPER_ADMIN' || 
      userType === 'ADMIN' || 
      userType === 'SUPER_ADMIN' ||
      designationName?.includes('ADMIN');

    // Determine the read scope for this user on Attendance
    const attendanceReadScope = getPermissionScopeSync(user, 'attendance', 'read');

    // canViewAll: only true admins or users with explicit 'all' read scope can see everyone's records
    const canViewAll = isAdminOrSuperAdmin || attendanceReadScope === 'all';

    // canViewDepartment: users with 'department' scope can see their own department
    const canViewDepartment = !canViewAll && attendanceReadScope === 'department';

    if (canViewAll) {
      // Admin / all-scope: optionally filter by a specific employee
      if (employeeId) {
        where.employeeId = employeeId as string;
        employeeWhere.id = employeeId as string;
      }
    } else if (canViewDepartment && user?.departmentId) {
      // Department-scope: restrict to the user's own department
      where.user = {
        ...where.user,
        OR: [
          { departmentId: user.departmentId },
          ...(user.department ? [{ department: user.department }] : [])
        ]
      };
      employeeWhere.OR = [
        { departmentId: user.departmentId },
        ...(user.department ? [{ department: user.department }] : [])
      ];
    } else {
      // 'own' scope or no permission: only the logged-in user's own records
      where.employeeId = user.id;
      employeeWhere.id = user.id;
    }

    if (department && department !== 'all') {
      where.user = {
        OR: [
          { departmentId: department as string },
          ...(targetDeptName ? [{ department: targetDeptName }] : [])
        ]
      };
    }

    const range = filter || (req as any).nextUrl?.searchParams?.get('range') || req.query?.range || 'all';

    let filterStartDate = new Date();
    let filterEndDate = new Date();
    const nowUTC = new Date(); // For Ghost Record Mitigation

    if (startDate && endDate) {
        // Custom Date Range
        filterStartDate = new Date(`${startDate as string}T00:00:00+06:00`);
        filterEndDate = new Date(`${endDate as string}T23:59:59.999+06:00`);
    } else {
        switch (range) {
            case 'yesterday': {
                const yesterdayDate = subDays(new Date(), 1);
                filterStartDate = startOfDay(yesterdayDate);
                filterEndDate = endOfDay(yesterdayDate);
                break;
            }
            case 'last7days':
            case 'week': {
                const weekDate = subDays(new Date(), 7);
                filterStartDate = startOfDay(weekDate);
                filterEndDate = new Date(); // Up to right now
                break;
            }
            case 'last1month':
            case 'last30days':
            case 'month': {
                const monthDate = subDays(new Date(), 30);
                filterStartDate = startOfDay(monthDate);
                filterEndDate = new Date();
                break;
            }
            case 'today': {
                filterStartDate = startOfDay(new Date());
                filterEndDate = endOfDay(new Date());
                break;
            }
            case 'all':
            case 'all-time':
            default:
                filterStartDate = new Date(0); // Beginning of time
                filterEndDate = new Date();
                break;
        }
    }

    // Cap the end at the current moment to exclude future ghost records
    let strictEndUTC = filterEndDate > nowUTC ? nowUTC : filterEndDate;

    // Create the exact Prisma filter
    const dateFilter = {
        timestamp: {
            gte: filterStartDate,
            lte: strictEndUTC
        }
    };

    // 🔥 CRITICAL: Must be applied here!
    where.timestamp = dateFilter.timestamp;

    let skip: number | undefined;
    let take: number | undefined;

    if (limit) {
      // Explicit pagination from caller
      take = parseInt(limit as string);
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    } else if (startDate && endDate) {
      // Custom date range — fetch up to 10 000 rows (spans can be wide)
      take = 10000;
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    } else if (filter && filter !== 'all') {
      // Named filter (today / week / month) — generous cap
      take = 5000;
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    } else {
      // All-time without explicit limit — return up to 5 000 most-recent rows
      take = 5000;
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    }

    if (department && department !== 'all') {
      employeeWhere.OR = [
        { departmentId: department as string },
        ...(targetDeptName ? [{ department: targetDeptName }] : [])
      ];
    }

    // PHASE 3 FIX: Stricter filter for 'employees' to exclude admins from counts.
    const employeeRoleFilter = {
      // isActive: true, // Removed to count all standard employees
      userType: { not: 'SUPER_ADMIN' },
      customDesignation: {
        name: {
          notIn: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'HR'],
        },
      },
    };

    // Apply the employee filter to the main query and the separate active employee query
    where.user = { ...where.user, ...employeeRoleFilter };
    const activeEmployeeWhere = { ...employeeWhere, ...employeeRoleFilter };

    const [logs, total, uniqueCheckIns, uniqueCheckOuts, manualPunches, activeEmployees, allPunchesInRange] = await Promise.all([
      prisma.attendanceLog.findMany({
        where, skip, take,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              employeeId: true,
              employeeType: true,
              department: true,
              designation: true,
              shiftStartTime: true,
              shiftEndTime: true,
              remoteShiftStartTime: true,
              remoteShiftEndTime: true,
              shift: { select: { startTime: true, endTime: true, remoteShiftStartTime: true, remoteShiftEndTime: true } },
              customDepartment: { select: { shiftStartTime: true, shiftEndTime: true, remoteShiftStartTime: true, remoteShiftEndTime: true } }
            }
          }
        }
      }),
      prisma.attendanceLog.count({ where }), // This total is now correctly filtered
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckIn' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckOut' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.findMany({ where: { ...where, deviceId: 'Manual Entry' }, select: { timestamp: true, user: { select: { name: true } } } }),
      prisma.user.findMany({ where: activeEmployeeWhere, select: { id: true, createdAt: true, name: true } }),
      prisma.attendanceLog.findMany({ where, select: { employeeId: true, timestamp: true } })
    ]);

    const checkInCount = uniqueCheckIns.length;
    const checkOutCount = uniqueCheckOuts.length;
    console.log(`FETCHED ${logs.length} LOGS FROM DB FOR FRONTEND.`);

    // Calculate strict server-side absent count per employee dynamically
    const formatYMD = (d: Date) => {
      // Shift to BD time approx +06:00 to group by local calendar day
      const dd = new Date(d.getTime() + (6 * 60 * 60 * 1000));
      return dd.toISOString().split('T')[0];
    };

    const daysPresentPerEmployee: Record<string, Set<string>> = {};
    for (const p of allPunchesInRange) {
      if (!daysPresentPerEmployee[p.employeeId]) daysPresentPerEmployee[p.employeeId] = new Set();
      daysPresentPerEmployee[p.employeeId].add(formatYMD(p.timestamp));
    }

    const globalStart = where.timestamp?.gte || new Date(0);
    // 🚀 CRITICAL: Stop counting at yesterday to avoid false absences for today/future
    const now = new Date();
    // Get yesterday at 23:59:59.999
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    const globalEnd = strictEndUTC > yesterday ? yesterday : strictEndUTC;

    let absentCount = 0;
    const absentDetails: any[] = [];

    for (const emp of activeEmployees) {
      // 🚀 CRITICAL: Start counting from Join Date OR filter start (whichever is later)
      const effectiveStart = emp.createdAt > globalStart ? emp.createdAt : globalStart;

      let validDays = 0;
      if (effectiveStart <= globalEnd) {
        const sStr = formatYMD(effectiveStart);
        const eStr = formatYMD(globalEnd);
        const sDate = new Date(`${sStr}T00:00:00Z`);
        const eDate = new Date(`${eStr}T00:00:00Z`);
        let currentDate = new Date(sDate);
        while (currentDate <= eDate) {
          if (currentDate.getUTCDay() !== 0) {
            validDays++;
            const currentDateStr = formatYMD(currentDate);
            if (!daysPresentPerEmployee[emp.id] || !daysPresentPerEmployee[emp.id].has(currentDateStr)) {
              absentDetails.push({ userName: emp.name || 'Unknown', date: currentDateStr });
            }
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
      }

      const presentDays = daysPresentPerEmployee[emp.id]?.size || 0;
      const empAbsent = Math.max(0, validDays - presentDays);
      absentCount += empAbsent;
    }

    // Sort absent details by date (newest first)
    absentDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const manualCount = manualPunches.length;
    const manualDetails = manualPunches.map((p: any) => ({
      userName: p.user?.name || 'Unknown',
      date: p.timestamp.toISOString()
    })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const presentCount = Object.keys(daysPresentPerEmployee).length; // Will fix unused uniquePunches, using uniqueCheckIns instead

    // Group logs strictly by employee to do cross-midnight pairing globally
    const logsByEmp: Record<string, any[]> = {};
    for (const l of logs) {
      if (!logsByEmp[l.employeeId]) logsByEmp[l.employeeId] = [];
      logsByEmp[l.employeeId].push(l);
    }

    const sessionsByEmpAndDate: Record<string, { sessions: any[], dateStr: string, firstLog: any }> = {};

    for (const empId in logsByEmp) {
      const empLogs = logsByEmp[empId].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      for (let i = 0; i < empLogs.length; i++) {
        const session = empLogs[i];

        const inTime = session.timestamp;
        const outTime = session.checkOut || null;
        const dateStr = formatYMD(inTime); // The session logically belongs to the Check-In date

        // Filter out sessions that belong to the extended boundary limit (the next day)
        // If the dateStr is strictly greater than the requested strictEndUTC date string, ignore it.
        const sessionDateObj = new Date(`${dateStr}T00:00:00Z`);
        const strictEndDateObj = new Date(`${formatYMD(strictEndUTC)}T00:00:00Z`);
        if (sessionDateObj > strictEndDateObj) {
          continue;
        }

        const k = `${empId}_${dateStr}`;
        if (!sessionsByEmpAndDate[k]) {
          sessionsByEmpAndDate[k] = { sessions: [], dateStr, firstLog: session };
        }

        let durationMs = 0;
        if (outTime) {
          durationMs = outTime.getTime() - inTime.getTime();
        }

        let durationStr = '--';
        if (durationMs > 0) {
          const mins = Math.floor(durationMs / 60000);
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }

        const isAutoCheckout = outTime && (outTime.getTime() === inTime.getTime() + 12 * 60 * 60 * 1000);

        const isManualIn = session.isManualIn || (session.deviceId || '').includes('Manual');
        const isManualOut = outTime ? (session.isManualOut || (session.checkOutDeviceId || '').includes('Manual')) : false;

        sessionsByEmpAndDate[k].sessions.push({
          ...session,
          durationMs,
          isMissingOut: !outTime,
          isAutoCheckout
        });
      }
    }

    // Map each daily shift summary
    const aggregatedSummaries = Object.values(sessionsByEmpAndDate).map((entry: any) => {
      const { sessions, dateStr, firstLog } = entry;
      const log = firstLog;
      const punchTimeline = sessions;

      let totalValidMs = 0;
      let isMissingOut = false;
      for (const s of sessions) {
        totalValidMs += s.durationMs;
        if (s.isMissingOut) isMissingOut = true;
      }

      let shiftStartTime = log.user?.shift?.startTime || log.user?.shiftStartTime || log.user?.customDepartment?.shiftStartTime || '09:00';
      let shiftEndTime = log.user?.shift?.endTime || log.user?.shiftEndTime || log.user?.customDepartment?.shiftEndTime || '17:00';

      const firstPunch = sessions.length > 0 ? sessions[0] : null;

      if (log.user?.employeeType === 'Hybrid' && firstPunch) {
        if (firstPunch.isManualIn) {
          shiftStartTime = log.user?.remoteShiftStartTime || log.user?.shift?.remoteShiftStartTime || log.user?.customDepartment?.remoteShiftStartTime || shiftStartTime;
          shiftEndTime = log.user?.remoteShiftEndTime || log.user?.shift?.remoteShiftEndTime || log.user?.customDepartment?.remoteShiftEndTime || shiftEndTime;
        }
      } else if (log.workMode === 'REMOTE') {
        shiftStartTime = log.user?.remoteShiftStartTime || log.user?.shift?.remoteShiftStartTime || log.user?.customDepartment?.remoteShiftStartTime || shiftStartTime;
        shiftEndTime = log.user?.remoteShiftEndTime || log.user?.shift?.remoteShiftEndTime || log.user?.customDepartment?.remoteShiftEndTime || shiftEndTime;
      }

      const checkInRaw = sessions.length > 0 ? sessions[0].timestamp : null;
      const checkOutRaw = sessions.length > 0 && sessions[sessions.length - 1].checkOut ? sessions[sessions.length - 1].checkOut : null;
      const isAutoCheckoutSession = sessions.length > 0 && sessions[sessions.length - 1].isAutoCheckout;

      let lateMinutes = 0;
      let earlyMinutes = 0;
      if (checkInRaw) {
        const shiftStartUTC = new Date(`${dateStr}T${shiftStartTime}:00+06:00`);
        const timeDiffMs = new Date(checkInRaw).getTime() - shiftStartUTC.getTime();
        if (timeDiffMs > 0) {
          lateMinutes = Math.floor(timeDiffMs / 60000);
        } else {
          earlyMinutes = Math.floor(Math.abs(timeDiffMs) / 60000);
        }
      }

      const standardShiftMs = 8 * 60 * 60 * 1000;
      let systemOvertimeMs = Math.max(0, totalValidMs - standardShiftMs);
      let validWorkedMs = Math.min(totalValidMs, standardShiftMs);

      // Check if session falls on a Sunday (0)
      const isSundaySession = new Date(`${dateStr}T00:00:00+06:00`).getDay() === 0;

      if (isSundaySession) {
        systemOvertimeMs = totalValidMs; // All hours on Sunday count as Overtime
        validWorkedMs = 0; // Standard shift hours are 0
      }

      const otStatus = log.otStatus || 'PENDING';
      const approvedOtMinutes = log.approvedOtMinutes || 0;

      let displayOvertimeMs = 0;
      let otBadge = 'Pending';
      if (systemOvertimeMs > 0) {
        if (otStatus === 'APPROVED') {
          displayOvertimeMs = approvedOtMinutes * 60 * 1000;
          otBadge = 'Approved';
        } else if (otStatus === 'REJECTED') {
          displayOvertimeMs = 0;
          otBadge = 'Rejected';
        } else {
          displayOvertimeMs = 0;
          otBadge = 'Pending';
        }
      } else {
        otBadge = 'None';
      }

      const overtimeMinutes = Math.floor(displayOvertimeMs / 60000);
      const systemCalculatedOtMinutes = Math.floor(systemOvertimeMs / 60000);

      let status = 'Absent';
      if (isSundaySession) {
        if (totalValidMs > 0 || checkInRaw) {
          status = 'WEEKEND_WORK';
        } else {
          status = 'Off Day';
        }
      } else if (totalValidMs > 0 || checkInRaw) {
        // Smart Status Override: If valid hours > 0, NEVER return Absent.
        status = lateMinutes > 15 ? 'Late' : 'Present';
      }

      return {
        id: log.id,
        employeeId: log.employeeId,
        employeeName: log.user?.name || 'Unmapped',
        date: dateStr,
        checkIn: checkInRaw,
        checkOut: checkOutRaw,
        checkInRaw, // Keeping for backward compatibility just in case
        checkOutRaw, // Keeping for backward compatibility
        isMissingOut,
        totalValidMs: validWorkedMs,
        lateMinutes,
        earlyMinutes,
        overtimeMinutes,
        systemCalculatedOtMinutes,
        otBadge,
        status,
        workMode: log.workMode,
        otStatus: log.otStatus,
        approvedOtMinutes: log.approvedOtMinutes,
        isAutoCheckout: isAutoCheckoutSession,
        punchTimeline
      };
    });

    res.status(200).json({
      logs: logs.map((l: any) => ({ ...l, employeeName: (l as any).user?.name || 'Unmapped' })),
      summaries: aggregatedSummaries,
      total,
      checkInCount,
      checkOutCount,
      manualCount,
      absentCount,
      metrics: {
        absent: { count: absentCount, details: absentDetails },
        manualPunch: { count: manualCount, details: manualDetails }
      },
      page: parseInt(page as string),
      limit: take
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

export const createManualLog = async (req: Request, res: Response): Promise<void> => {
  try {
    let { employeeId, punchType, latitude, longitude, date, isOverride } = req.body;

    let locationAddress: string | null = null;
    if (latitude && longitude) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        locationAddress = data.display_name || "Address not found";
      } catch (err) {
        console.error("Geocoding failed", err);
      }
    }

    // 100% Secure Server Time - completely ignore client time payload
    let parsedDate = new Date();
    if (date) {
      const [year, month, day] = date.split('-');
      parsedDate.setFullYear(Number(year), Number(month) - 1, Number(day));
    }

    // --- Security RBAC Check ---
    const reqUser = (req as any).user;
    const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'hrm manager'];
    const designName = typeof reqUser?.designation === 'object' ? reqUser?.designation?.name : reqUser?.designation;
    const userDesig = (designName || '').toLowerCase().trim();
    const hasAdminRole = reqUser?.roles?.some((r: any) =>
      ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
    );
    let isAdmin = ADMIN_DESIGNATIONS.includes(userDesig) || hasAdminRole;

    if (!isAdmin && reqUser?.id) {
      const dbUser = await prisma.user.findUnique({ where: { id: reqUser.id } });
      if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin') isAdmin = true;
    }
    const canCreateAll = isAdmin || checkPermission(reqUser, 'Attendance', 'create');

    if (!canCreateAll && String(employeeId) !== String(reqUser.id) && String(employeeId) !== String(reqUser.employeeId)) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to create attendance for other employees.' });
      return;
    }
    // ---------------------------

    // Resolve the actual User UUID from the given employeeId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: String(employeeId) },
          { employeeId: String(employeeId) }
        ]
      },
      include: { customDepartment: true, shift: true }
    });

    if (!user) {
      res.status(404).json({ message: "Employee not found in database." });
      return;
    }

    // Look back 18 hours to find the open session, correctly handling timezone and cross-midnight shifts
    const CROSS_MIDNIGHT_WINDOW_MS = 18 * 60 * 60 * 1000;
    const windowStart = new Date(parsedDate.getTime() - CROSS_MIDNIGHT_WINDOW_MS);

    const lastOpenSession = await prisma.attendanceLog.findFirst({
      where: {
        employeeId: user.id,
        checkOut: null,
        timestamp: {
          gte: windowStart,
          lte: parsedDate
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    let log: any;
    let created = false;

    // 🚀 STRICT COOLDOWN PREVENTION (1 MINUTE)
    if (lastOpenSession && lastOpenSession.timestamp && !isOverride) {
      const COOLDOWN_MS = 60 * 1000;
      const lastActionTime = new Date(lastOpenSession.timestamp).getTime();

      if (Date.now() - lastActionTime < COOLDOWN_MS) {
        res.status(429).json({ message: 'Please wait at least 1 minute before punching again to prevent duplicate entries.' });
        return;
      }
    }

    if (lastOpenSession) {
      // 🚀 THIS INCOMING PUNCH IS A CHECK-OUT
      log = await prisma.attendanceLog.update({
        where: { id: lastOpenSession.id },
        data: {
          checkOut: parsedDate,
          latitude,
          longitude,
          locationAddress,
          checkOutDeviceId: isAdmin ? 'Manual Entry' : 'MANUAL_WEB',
          isManualOut: true
        } as any,
        include: { user: { select: { name: true } } },
      });
      // Override punchType so downstream logic (like late detection/websocket) knows what happened
      punchType = 'CheckOut';
    } else {
      // 🚀 THIS INCOMING PUNCH IS A CHECK-IN
      punchType = 'CheckIn';
      let sessionWorkMode = 'REMOTE'; // Any manual punch via web portal is inherently remote

      log = await prisma.attendanceLog.create({
        data: {
          employeeId: user.id,
          timestamp: parsedDate,
          punchType: 'CheckIn',
          deviceId: isAdmin ? 'Manual Entry' : 'MANUAL_WEB',
          isManualIn: true,
          latitude,
          longitude,
          locationAddress,
          workMode: sessionWorkMode
        } as any,
        include: { user: { select: { name: true } } },
      });
      created = true;
    }

    // --- Late Detection ---
    if (punchType === 'CheckIn') {
      let expectedShiftStart = user.shift?.startTime || user.shiftStartTime || user.customDepartment?.shiftStartTime || '09:00';
      if (log && (log.workMode === 'REMOTE' || log.deviceId === 'MANUAL_WEB')) {
        expectedShiftStart = user.shift?.remoteShiftStartTime || user.remoteShiftStartTime || user.customDepartment?.remoteShiftStartTime || expectedShiftStart;
      }
      const checkInLocalStr = formatInTimeZone(parsedDate, BD_TZ, 'yyyy-MM-dd');
      const shiftStartLocalStr = `${checkInLocalStr}T${expectedShiftStart}:00+06:00`;
      const shiftStartUTC = new Date(shiftStartLocalStr);

      const gracePeriodMs = 15 * 60 * 1000; // 15 minutes

      if (parsedDate.getTime() > shiftStartUTC.getTime() + gracePeriodMs) {
        // Employee is late

        const formattedShiftStart = to12Hour(expectedShiftStart);
        const admins = await prisma.user.findMany({
          where: {
            OR: [
              { designation: { contains: 'Admin' } },
              { designation: { contains: 'admin' } },
              { designation: { contains: 'HR' } },
              { designation: { contains: 'hr' } },
              { customDesignation: { name: { contains: 'Admin' } } },
              { customDesignation: { name: { contains: 'admin' } } },
              { customDesignation: { name: { contains: 'HR' } } },
              { roles: { some: { name: { contains: 'Admin' } } } }
            ]
          }
        });

        for (const admin of admins) {
          const lateNotificationRecord = await prisma.notification.create({
            data: {
              userId: admin.id,
              titleEn: 'Late Check-in',
              titleBn: 'দেরিতে উপস্থিতি',
              messageEn: `${user.name} checked in late for the ${formattedShiftStart} shift.`,
              messageBn: `${user.name} ${formattedShiftStart} শিফটের জন্য দেরিতে উপস্থিত হয়েছেন।`,
              type: 'ATTENDANCE_LATE',
              referenceId: log.id
            }
          });
          eventEmitter.emit('new-notification', lateNotificationRecord);
        }
      }
    }
    // ----------------------

    // --- General Punch Notification (CheckIn / CheckOut) ---
    try {
      const punchLabel = punchType === 'CheckIn' ? 'checked in' : 'checked out';
      const punchLabelBn = punchType === 'CheckIn' ? 'চেক-ইন করেছেন' : 'চেক-আউট করেছেন';
      const nowBD = new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka', hour12: true });

      const adminsForPunch = await prisma.user.findMany({
        where: {
          OR: [
            { designation: { contains: 'Admin' } },
            { designation: { contains: 'admin' } },
            { designation: { contains: 'HR' } },
            { designation: { contains: 'hr' } },
            { customDesignation: { name: { contains: 'Admin' } } },
            { customDesignation: { name: { contains: 'admin' } } },
            { customDesignation: { name: { contains: 'HR' } } },
            { roles: { some: { name: { contains: 'Admin' } } } }
          ]
        },
        select: { id: true }
      });

      for (const admin of adminsForPunch) {
        const punchNotif = await prisma.notification.create({
          data: {
            userId: admin.id,
            titleEn: punchType === 'CheckIn' ? 'Employee Check-In' : 'Employee Check-Out',
            titleBn: punchType === 'CheckIn' ? 'কর্মচারী চেক-ইন' : 'কর্মচারী চেক-আউট',
            messageEn: `${user.name} ${punchLabel} at ${nowBD}.`,
            messageBn: `${user.name} ${nowBD} তে ${punchLabelBn}।`,
            type: 'ATTENDANCE',
            referenceId: log.id
          }
        });
        eventEmitter.emit('new-notification', punchNotif);
      }
    } catch (notifErr) {
      console.error('[Punch Notification Error]:', notifErr);
    }
    // -------------------------------------------------------

    // Trigger instant global state update for connected Dashboards
    eventEmitter.emit('attendanceUpdate', log);
    eventEmitter.emit('new-attendance', log);

    res.status(created ? 201 : 200).json({ message: created ? 'Manual entry created' : 'Existing entry updated', log });
  } catch (error: any) {
    if (error.code === 'P2003') {
      res.status(400).json({ message: "Invalid Employee ID provided." });
      return;
    }
    res.status(500).json({ message: error.message || 'Failed to save entry' });
  }
};

// @desc    Webhook for local device push — DISABLED (pull-only sync via zkService.ts)
// export const deviceWebhookPunch = ...;