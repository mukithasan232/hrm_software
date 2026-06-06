import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { runWithDeviceLock, startRealtimeListener } from '../services/realtimeService';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

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

// @desc    Get active presence stats for dashboard
export const getActivePresence = async (req: Request, res: Response) => {
  try {
    const tzOffset = 6 * 60 * 60 * 1000;
    const nowBD = new Date(new Date().getTime() + tzOffset);
    
    // Start of Local Day (00:00:00) converted to UTC
    const startOfToday = new Date(Date.UTC(nowBD.getUTCFullYear(), nowBD.getUTCMonth(), nowBD.getUTCDate(), 0, 0, 0, 0) - tzOffset);
    // End of Local Day (23:59:59) converted to UTC
    const endOfToday = new Date(Date.UTC(nowBD.getUTCFullYear(), nowBD.getUTCMonth(), nowBD.getUTCDate(), 23, 59, 59, 999) - tzOffset);

    const [uniqueCheckInsToday, uniqueCheckOutsToday] = await Promise.all([
      prisma.attendanceLog.findMany({ where: { timestamp: { gte: startOfToday, lte: endOfToday }, punchType: 'CheckIn' }, distinct: ['employeeId'] }),
      prisma.attendanceLog.findMany({ where: { timestamp: { gte: startOfToday, lte: endOfToday }, punchType: 'CheckOut' }, distinct: ['employeeId'] })
    ]);

    const checkedInIds = new Set(uniqueCheckInsToday.map((l: any) => l.employeeId));
    const checkedOutIds = new Set(uniqueCheckOutsToday.map((l: any) => l.employeeId));
    const activeNow = Array.from(checkedInIds).filter(id => !checkedOutIds.has(id)).length;

    const logs = await prisma.attendanceLog.findMany({
      where: { timestamp: { gte: startOfToday, lte: endOfToday } },
      take: 50,
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

    if (filter === 'today' || filter === 'yesterday') {
      const tzOffset = 6 * 60 * 60 * 1000;
      const now = new Date();
      
      // Determine base time
      const targetTime = filter === 'yesterday' 
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000) 
        : now;

      // Convert to Dhaka time to safely determine day boundaries
      const localTime = new Date(targetTime.getTime() + tzOffset);

      // Create UTC start/end points for the whole day in Dhaka time
      const startOfLocalDay = new Date(Date.UTC(localTime.getUTCFullYear(), localTime.getUTCMonth(), localTime.getUTCDate(), 0, 0, 0, 0));
      const endOfLocalDay = new Date(Date.UTC(localTime.getUTCFullYear(), localTime.getUTCMonth(), localTime.getUTCDate(), 23, 59, 59, 999));

      // Subtract the offset to get the exact UTC range for the DB
      where.timestamp = { 
        gte: new Date(startOfLocalDay.getTime() - tzOffset), 
        lte: new Date(endOfLocalDay.getTime() - tzOffset) 
      };
    }

    const [logs, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where, skip, take,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, employeeId: true, department: true } } }
      }),
      prisma.attendanceLog.count({ where })
    ]);

    res.status(200).json({ logs: logs.map(l => ({ ...l, employeeName: l.user?.name || 'Unmapped' })), total, page: parseInt(page as string), limit: take });
  } catch (error: any) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

// @desc    Create manual attendance record
export const createManualLog = async (req: Request, res: Response) => {
  try {
    const { employeeId, timestamp, punchType } = req.body;
    const log = await prisma.attendanceLog.create({
      data: { employeeId, timestamp: new Date(timestamp), punchType, deviceId: 'Manual Entry' },
      include: { user: { select: { name: true } } }
    });
    res.status(201).json({ message: 'Manual entry created', log });
  } catch (error: any) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

// @desc    Webhook for local device push
export const deviceWebhookPunch = async (req: Request, res: Response) => {
  try {
    const isBatch = Array.isArray(req.body.logs);
    let logsToProcess = isBatch ? req.body.logs : [req.body];

    for (const item of logsToProcess) {
      const deviceUserId = item.deviceUserId || item.userSn || item.employeeId;
      const parsedTimestamp = new Date(item.recordTime || item.timestamp);
      
      let user = await prisma.user.findFirst({
        where: { OR: [{ employeeId: String(deviceUserId).trim() }, { id: String(deviceUserId).trim() }] },
        select: { id: true, name: true }
      });

      if (!user) {
        await (prisma as any).rawDeviceLog.upsert({
            where: { deviceUserId_recordTime: { deviceUserId: String(deviceUserId), recordTime: parsedTimestamp } },
            update: { punchType: item.status || 'CheckIn' },
            create: { deviceUserId: String(deviceUserId), recordTime: parsedTimestamp, punchType: item.status || 'CheckIn' }
        });
        continue;
      }

      await prisma.attendanceLog.upsert({
        where: { employeeId_timestamp: { employeeId: user.id, timestamp: parsedTimestamp } },
        update: { punchType: item.status || 'CheckIn' },
        create: { employeeId: user.id, timestamp: parsedTimestamp, punchType: item.status || 'CheckIn', deviceId: 'Webhook' }
      });
    }
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};