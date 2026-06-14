import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { runWithDeviceLock, startRealtimeListener } from '../services/realtimeService';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { Parser } from 'json2csv';

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
    const logs = await prisma.attendanceLog.findMany({
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

// @desc    Get active presence stats for dashboard
export const getActivePresence = async (req: Request, res: Response) => {
  try {
    const queryDate = req.query.date as string | undefined;
    const { start, end } = queryDate ? getDayBoundaries(queryDate) : getTodayBoundaries();

    // 1. Fetch all attendance logs for the period, ordered by latest first
    const todaysLogs = await prisma.attendanceLog.findMany({
      where: { 
        timestamp: { gte: start, lte: end }
      },
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

    res.status(200).json({
      totalToday: totalUniqueEmployeesToday,
      activeNow: currentlyPresentLogs.length,
      // Only currently-present (last punch = CheckIn) — used by stat card
      recent: currentlyPresentLogs.map(mapLog),
      // All employees who punched today (any type) — used by Live Activity feed
      recentAll: allLatestPunchLogs.map(mapLog),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// @desc    Get all stored attendance logs
export const getAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const { page, limit, employeeId, filter, department, startDate, endDate } = req.query;

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;
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
    } else if ((!filter || filter === 'all') && !startDate && !endDate) {
      take = 50;
      skip = page ? (parseInt(page as string) - 1) * take : 0;
    }

    const employeeWhere: any = { isActive: true };
    if (department && department !== 'all') {
      employeeWhere.department = department as string;
    }

    const [logs, total, uniqueCheckIns, uniqueCheckOuts, manualCount, totalEmployees, uniquePunches] = await Promise.all([
      prisma.attendanceLog.findMany({
        where, skip, take,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, employeeId: true, department: true } } }
      }),
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckIn' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckOut' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.count({ where: { ...where, deviceId: 'Manual Entry' } }),
      prisma.user.count({ where: employeeWhere }),
      prisma.attendanceLog.findMany({ where, distinct: ['employeeId'], select: { employeeId: true } })
    ]);

    const checkInCount = uniqueCheckIns.length;
    const checkOutCount = uniqueCheckOuts.length;
    
    // Calculate strict server-side absent count based on presence (any valid punch = present)
    const presentCount = uniquePunches.length;
    const absentCount = Math.max(0, totalEmployees - presentCount);

    res.status(200).json({ 
      logs: logs.map(l => ({ ...l, employeeName: l.user?.name || 'Unmapped' })), 
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

// @desc    Create manual attendance record
export const createManualLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, timestamp, punchType } = req.body;
    
    // Ensure the date string is correctly parsed into a valid ISO-8601 Date object
    const parsedDate = new Date(timestamp);
    
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ message: 'Invalid timestamp format.' });
      return;
    }

    // Resolve the actual User UUID from the given employeeId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: String(employeeId) },
          { employeeId: String(employeeId) }
        ]
      }
    });

    if (!user) {
      res.status(404).json({ message: "Employee not found in database." });
      return;
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