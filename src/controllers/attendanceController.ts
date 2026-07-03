import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { runWithDeviceLock, startRealtimeListener } from '../services/realtimeService';
import { prisma } from '../lib/prisma';
import { checkPermission } from '../utils/checkPermission';
import bcrypt from 'bcryptjs';
import { Parser } from 'json2csv';
import { eventEmitter } from '../lib/eventEmitter';

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

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
      targetDate.setMonth(targetDate.getMonth() - 1);
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

// @desc    Legacy sync (used by cron job)
export const syncDeviceLogs = async (req: Request, res: Response) => {
  try {
    // Pure additive sync — no destructive wipe. The DB unique constraint
    // (@@unique([employeeId, timestamp])) and skipDuplicates:true on createMany
    // are the sole deduplication mechanism.
    const newRecordsCount = await runWithDeviceLock(() => fetchDeviceLogs());
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
    const result = await runWithDeviceLock(() => getDeviceAttendance());
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
    const userRole = user?.designation || '';
    let isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'HR'].includes(userRole);

    if (!isAdmin && user?.id) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin') isAdmin = true;
    }

    const where: any = {};
    if (!isAdmin && user?.id) {
      where.employeeId = user.id;
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
    const userRole = user?.designation || '';
    let isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'HR'].includes(userRole);

    if (!isAdmin && user?.id) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin') isAdmin = true;
    }

    const queryDate = req.query.date as string | undefined;
    const { start, end } = queryDate ? getDayBoundaries(queryDate) : getTodayBoundaries();

    const whereClause: any = { timestamp: { gte: start, lte: end } };
    if (!isAdmin && user?.id) {
      whereClause.employeeId = user.id;
    }

    // 1. Fetch attendance logs for the period, ordered by latest first
    const todaysLogs = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: { user: { select: { name: true } } },
      orderBy: { timestamp: 'desc' }
    });

    // 2. Filter: Find employees whose MOST RECENT punch is a "Check In"
    const currentlyPresentLogs: any[] = [];
    const allLatestPunchLogs: any[] = []; // every employee who punched today (any type)
    const seenEmployees = new Set();
    let totalUniqueEmployeesToday = 0;

    for (const log of todaysLogs) {
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

    // Task 2: Accurate Absenteeism Calculation
    const totalActiveEmployees = await prisma.user.count({
      where: { isActive: true }
    });
    
    const employeesOnLeaveCount = await prisma.leave.count({
      where: {
        status: 'Approved',
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });

    let calculatedAbsent = totalActiveEmployees - totalUniqueEmployeesToday - employeesOnLeaveCount;
    calculatedAbsent = calculatedAbsent < 0 ? 0 : calculatedAbsent;

    res.status(200).json({
      totalToday: totalUniqueEmployeesToday,
      activeNow: currentlyPresentLogs.length,
      totalAbsent: calculatedAbsent,
      recent: currentlyPresentLogs.map(mapLog),
      recentAll: allLatestPunchLogs.map(mapLog),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// @desc    Get all stored attendance logs
export const getAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRole = user?.designation || '';
    let isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'HR'].includes(userRole);

    if (!isAdmin && user?.id) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin') {
        isAdmin = true;
      }
    }

    const { page, limit, employeeId, filter, department, startDate, endDate } = req.query;

    const where: any = {};
    if (!isAdmin && user?.id) {
      where.employeeId = user.id;
    } else if (employeeId) {
      where.employeeId = employeeId as string;
    }
    if (department && department !== 'all') where.user = { department: department as string };

    const nowUTC = new Date(); // For Ghost Record Mitigation

    if (startDate && endDate) {
      const startUTC = new Date(`${startDate as string}T00:00:00+06:00`);
      const endUTC = new Date(`${endDate as string}T23:59:59.999+06:00`);
      const effectiveEndUTC = endUTC > nowUTC ? nowUTC : endUTC;
      where.timestamp = { gte: startUTC, lte: effectiveEndUTC };
    } else if (filter && filter !== 'all') {
      const { start, end } = getDayBoundaries(filter as any);
      const effectiveEnd = end > nowUTC ? nowUTC : end;
      where.timestamp = { gte: start, lte: effectiveEnd };
    } else {
      where.timestamp = { lte: nowUTC }; // Ignore future ghost records
    }

    let skip: number | undefined;
    let take: number | undefined;

    if (limit) {
      take = parseInt(limit as string);
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    } else if (startDate && endDate) {
      take = 10000; // Large fallback for custom date ranges without limit
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    } else if (!filter || filter === 'all') {
      take = 50;
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    }

    const employeeWhere: any = { isActive: true };
    if (department && department !== 'all') {
      employeeWhere.department = department as string;
    }

    const [logs, total, uniqueCheckIns, uniqueCheckOuts, manualCount, activeEmployees, allPunchesInRange] = await Promise.all([
      prisma.attendanceLog.findMany({
        where, skip, take,
        orderBy: { timestamp: 'desc' },
        include: { 
          user: { 
            select: { 
              name: true, 
              employeeId: true, 
              department: true, 
              shiftStartTime: true, 
              shiftEndTime: true,
              shift: { select: { startTime: true, endTime: true } },
              customDepartment: { select: { shiftStartTime: true, shiftEndTime: true } }
            } 
          } 
        }
      }),
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckIn' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckOut' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.count({ where: { ...where, deviceId: 'Manual Entry' } }),
      prisma.user.findMany({ where: employeeWhere, select: { id: true, createdAt: true } }),
      prisma.attendanceLog.findMany({ where, select: { employeeId: true, timestamp: true } })
    ]);

    const checkInCount = uniqueCheckIns.length;
    const checkOutCount = uniqueCheckOuts.length;
    
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
    const globalEnd = where.timestamp?.lte || new Date(); 
    const msPerDay = 1000 * 60 * 60 * 24;

    let absentCount = 0;

    for (const emp of activeEmployees) {
      // Compare the global range start with the employee's creation date
      const effectiveStart = emp.createdAt > globalStart ? emp.createdAt : globalStart;
      
      let validDays = 0;
      if (effectiveStart <= globalEnd) {
        const sStr = formatYMD(effectiveStart);
        const eStr = formatYMD(globalEnd);
        const sDate = new Date(`${sStr}T00:00:00Z`);
        const eDate = new Date(`${eStr}T00:00:00Z`);
        validDays = Math.max(0, Math.round((eDate.getTime() - sDate.getTime()) / msPerDay) + 1);
      }
      
      const presentDays = daysPresentPerEmployee[emp.id]?.size || 0;
      const empAbsent = Math.max(0, validDays - presentDays);
      absentCount += empAbsent;
    }

    const presentCount = Object.keys(daysPresentPerEmployee).length; // Will fix unused uniquePunches, using uniqueCheckIns instead
    
    // Build Aggregated Summaries Server-Side
    const summariesMap: Record<string, any> = {};
    for (const log of logs) {
      const dateStr = formatYMD(log.timestamp);
      const key = `${log.employeeId}_${dateStr}`;
      if (!summariesMap[key]) {
        summariesMap[key] = {
          employeeId: log.employeeId,
          employeeName: (log as any).user?.name || 'Unmapped',
          date: dateStr,
          rawLogs: [],
          shiftStartTime: (log as any).user?.shift?.startTime || (log as any).user?.shiftStartTime || (log as any).user?.customDepartment?.shiftStartTime || '09:00',
          shiftEndTime: (log as any).user?.shift?.endTime || (log as any).user?.shiftEndTime || (log as any).user?.customDepartment?.shiftEndTime || '17:00'
        };
      }
      summariesMap[key].rawLogs.push(log);
    }

    const aggregatedSummaries = Object.values(summariesMap).map(summary => {
      const { rawLogs, shiftStartTime, shiftEndTime } = summary;
      rawLogs.sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const checkInRaw = rawLogs.find((l: any) => l.punchType?.toLowerCase().includes('in'))?.timestamp || null;
      let checkOutRaw = null;
      for (let i = rawLogs.length - 1; i >= 0; i--) {
        if (rawLogs[i].punchType?.toLowerCase().includes('out')) {
          checkOutRaw = rawLogs[i].timestamp;
          break;
        }
      }

      const lastPunch = rawLogs[rawLogs.length - 1];
      const isMissingOut = lastPunch?.punchType?.toLowerCase().includes('in');

      let totalValidMs = 0;
      let currentIn = null;
      for (const l of rawLogs) {
        if (l.punchType?.toLowerCase().includes('in')) {
          if (!currentIn) currentIn = l.timestamp;
        } else {
          if (currentIn) {
            totalValidMs += (l.timestamp.getTime() - currentIn.getTime());
            currentIn = null;
          }
        }
      }

      let lateMinutes = 0;
      if (checkInRaw) {
        const shiftStartUTC = new Date(`${summary.date}T${shiftStartTime}:00+06:00`);
        const lateMs = Math.max(0, checkInRaw.getTime() - shiftStartUTC.getTime());
        lateMinutes = Math.floor(lateMs / 60000);
      }

      const shiftStartUTC = new Date(`${summary.date}T${shiftStartTime}:00+06:00`);
      let shiftEndUTC = new Date(`${summary.date}T${shiftEndTime}:00+06:00`);
      if (shiftEndUTC.getTime() < shiftStartUTC.getTime()) {
        shiftEndUTC.setDate(shiftEndUTC.getDate() + 1);
      }
      const standardShiftMs = shiftEndUTC.getTime() - shiftStartUTC.getTime();
      
      let overtimeMinutes = 0;
      if (totalValidMs > standardShiftMs && standardShiftMs > 0) {
        overtimeMinutes = Math.floor((totalValidMs - standardShiftMs) / 60000);
      }

      return {
        employeeId: summary.employeeId,
        employeeName: summary.employeeName,
        date: summary.date,
        checkInRaw,
        checkOutRaw,
        isMissingOut,
        totalValidMs,
        lateMinutes,
        overtimeMinutes
      };
    });

    res.status(200).json({ 
      logs: logs.map(l => ({ ...l, employeeName: (l as any).user?.name || 'Unmapped' })), 
      summaries: aggregatedSummaries,
      total, 
      checkInCount, 
      checkOutCount, 
      manualCount,
      absentCount, 
      page: parseInt(page as string), 
      limit: take 
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

export const createManualLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, timestamp, punchType } = req.body;
    
    // Ensure the date string is correctly parsed into a valid ISO-8601 Date object
    let parsedDate = new Date(timestamp);
    
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ message: 'Invalid timestamp format.' });
      return;
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
    
    // Enforce Server Time for standard employees
    if (!canCreateAll) {
      parsedDate = new Date();
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

    // Task 1: 🚀 LAZY AUTO-CHECKOUT (Forgot to checkout)
    const lastRecord = await prisma.attendanceLog.findFirst({
      where: { employeeId: user.id },
      orderBy: { timestamp: 'desc' }
    });

    const now = new Date();
    if (lastRecord && lastRecord.punchType?.toLowerCase().includes('in')) {
      const checkInTime = lastRecord.timestamp.getTime();
      const hoursSinceCheckIn = (now.getTime() - checkInTime) / (1000 * 60 * 60);

      if (hoursSinceCheckIn > 14) {
        const autoCheckOutTime = new Date(checkInTime + 8 * 60 * 60 * 1000); // Add 8 standard hours
        await prisma.attendanceLog.create({
          data: {
            employeeId: user.id,
            timestamp: autoCheckOutTime,
            punchType: 'CheckOut',
            deviceId: 'System Auto-Checkout'
          }
        });
      }
    }

    const log = await prisma.attendanceLog.upsert({
      where: {
        employeeId_timestamp: {
          employeeId: user.id,
          timestamp: parsedDate,
        },
      },
      update: { punchType },
      create: {
        employeeId: user.id,
        timestamp: parsedDate,
        punchType,
        deviceId: 'Manual Entry',
      },
      include: { user: { select: { name: true } } },
    });
    const created = log.createdAt === log.updatedAt;

    // --- Late Detection ---
    if (punchType === 'CheckIn') {
      const expectedShiftStart = user.shift?.startTime || user.shiftStartTime || user.customDepartment?.shiftStartTime || '09:00';
      const checkInLocalStr = formatInTimeZone(parsedDate, BD_TZ, 'yyyy-MM-dd');
      const shiftStartLocalStr = `${checkInLocalStr}T${expectedShiftStart}:00+06:00`;
      const shiftStartUTC = new Date(shiftStartLocalStr);
      
      const gracePeriodMs = 10 * 60 * 1000; // 10 minutes

      if (parsedDate.getTime() > shiftStartUTC.getTime() + gracePeriodMs) {
        // Employee is late
        
        // Format to 12-hour AM/PM
        const [hourStr, minuteStr] = expectedShiftStart.split(':');
        let hour = parseInt(hourStr, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        const formattedShiftStart = `${hour.toString().padStart(2, '0')}:${minuteStr} ${ampm}`;

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