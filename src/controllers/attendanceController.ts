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
  const startUTC = fromZonedTime(`${todayStr}T00:00:00`, BD_TZ);
  const endUTC = fromZonedTime(`${todayStr}T23:59:59.999`, BD_TZ);
  return { start: startUTC, end: endUTC };
}

function getDayBoundaries(filter: 'today' | 'yesterday' | 'week' | 'month'): { start: Date; end: Date } {
  const targetDate = new Date();
  if (filter === 'yesterday') {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (filter === 'week') {
    targetDate.setDate(targetDate.getDate() - 7);
  } else if (filter === 'month') {
    targetDate.setMonth(targetDate.getMonth() - 1);
  }
  
  const dateStr = formatInTimeZone(targetDate, BD_TZ, 'yyyy-MM-dd');
  const startUTC = fromZonedTime(`${dateStr}T00:00:00`, BD_TZ);
  const endUTC = fromZonedTime(filter === 'today' || filter === 'yesterday' ? `${dateStr}T23:59:59.999` : `${formatInTimeZone(new Date(), BD_TZ, 'yyyy-MM-dd')}T23:59:59.999`, BD_TZ);
  
  return { start: startUTC, end: endUTC };
}

// @desc    Legacy sync (used by cron job)
export const syncDeviceLogs = async (req: Request, res: Response) => {
  try {
    await prisma.attendanceLog.deleteMany({});
    console.log("🧹 [syncDeviceLogs] Wiped all attendance logs for fresh sync!");

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
  try {
    await prisma.attendanceLog.deleteMany({});
    console.log("🧹 [syncLive] Wiped all attendance logs for fresh live sync!");
  } catch (err: any) {
    console.error('[SyncLive] Error wiping logs:', err.message);
  }

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
    const { start, end } = getTodayBoundaries();

    const [uniqueCheckInsToday, uniqueCheckOutsToday] = await Promise.all([
      prisma.attendanceLog.findMany({ where: { timestamp: { gte: start, lte: end }, punchType: 'CheckIn' }, distinct: ['employeeId'] }),
      prisma.attendanceLog.findMany({ where: { timestamp: { gte: start, lte: end }, punchType: 'CheckOut' }, distinct: ['employeeId'] })
    ]);

    const checkedInIds = new Set(uniqueCheckInsToday.map((l: any) => l.employeeId));
    const checkedOutIds = new Set(uniqueCheckOutsToday.map((l: any) => l.employeeId));
    const activeNow = Array.from(checkedInIds).filter(id => !checkedOutIds.has(id)).length;

    const logs = await prisma.attendanceLog.findMany({
      where: { timestamp: { gte: start, lte: end } },
      take: 15,
      distinct: ['employeeId'],
      include: { user: { select: { name: true } } },
      orderBy: { timestamp: 'desc' }
    });

    res.status(200).json({
      totalToday: checkedInIds.size,
      activeNow,
      recent: logs.map((log: any) => ({ ...log, employeeName: log.user?.name || 'Unmapped' }))
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// @desc    Get all stored attendance logs
export const getAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', employeeId, filter } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;

    if (filter && filter !== 'all') {
      const { start, end } = getDayBoundaries(filter as any);
      where.timestamp = { gte: start, lte: end };
    }

    const [logs, total, uniqueCheckIns, uniqueCheckOuts, manualCount] = await Promise.all([
      prisma.attendanceLog.findMany({
        where, skip, take,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, employeeId: true, department: true } } }
      }),
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckIn' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.findMany({ where: { ...where, punchType: 'CheckOut' }, distinct: ['employeeId'], select: { employeeId: true } }),
      prisma.attendanceLog.count({ where: { ...where, deviceId: 'Manual Entry' } })
    ]);

    const checkInCount = uniqueCheckIns.length;
    const checkOutCount = uniqueCheckOuts.length;

    res.status(200).json({ 
      logs: logs.map(l => ({ ...l, employeeName: l.user?.name || 'Unmapped' })), 
      total, 
      checkInCount, 
      checkOutCount, 
      manualCount, 
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