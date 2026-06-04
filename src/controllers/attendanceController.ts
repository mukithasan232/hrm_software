import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { runWithDeviceLock, startRealtimeListener } from '../services/realtimeService';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

// @desc    Legacy sync (used by cron job)
// @route   POST /api/attendance/sync
// @access  Admin
export const syncDeviceLogs = async (req: Request, res: Response) => {
  try {
    // CRITICAL DATA WIPE: Temporary command to start fresh
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

// @desc    Live sync with full stats + user-to-employee matching
// @route   POST /api/attendance/sync-live
// @access  Admin
export const syncLive = async (req: Request, res: Response) => {
  try {
    // CRITICAL DATA WIPE: Temporary command to start fresh
    await prisma.attendanceLog.deleteMany({});
    console.log("🧹 [syncLive] Wiped all attendance logs for fresh live sync!");
  } catch (err: any) {
    console.error('[SyncLive] Error wiping logs:', err.message);
  }

  res.status(200).json({
    message: 'Biometric sync started in the background. Please wait a few moments for the logs to populate.',
    status: 'processing'
  });

  // Background execution
  (async () => {
    try {
      console.log('[BackgroundSync] Starting full device sync...');
      await runWithDeviceLock(() => getDeviceAttendance());
      console.log('[BackgroundSync] ✅ Sync complete.');
    } catch (err: any) {
      console.error('[BackgroundSync] ❌ Sync failed:', err.message);
    }
  })();
};

// @desc    Ping the ZKTeco device
// @route   GET /api/attendance/device-status
// @access  Admin
export const getDeviceStatus = async (req: Request, res: Response) => {
  const result = await runWithDeviceLock(() => pingDevice());
  const status = result.reachable ? 200 : 503;
  res.status(status).json(result);
};

// @desc    Sync device users to Prisma DB
// @route   POST /api/attendance/sync-users
// @access  Admin
export const syncDeviceUsersToDB = async (req: Request, res: Response) => {
  try {
    // Guard: prevent cloud-to-local direct sync in production
    if (process.env.NODE_ENV === 'production') {
      const ip = process.env.ZK_DEVICE_IP || '';
      const isLocal = ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.');
      if (isLocal) {
        return res.status(400).json({
          success: false,
          message: 'Direct cloud-to-local sync is restricted. Please ensure the Office Sync Daemon is running to push data to the cloud.',
        });
      }
    }

    // On-demand only — connects, syncs, then disconnects.
    const result = await runWithDeviceLock(() => getDeviceAttendance());

    // After a successful manual sync, start the realtime listener so live
    // punches are captured until the next server restart.
    startRealtimeListener();

    res.status(200).json({
      success: true,
      message: `Sync complete. ${result.synced} record(s) synced, ${result.skipped} skipped.`,
      synced:  result.synced,
      skipped: result.skipped,
      total:   result.total,
    });
  } catch (error: any) {
    console.error('[syncDeviceUsersToDB] ❌', error.message);
    res.status(503).json({
      success: false,
      message: 'Biometric device offline or unreachable. Please check the device and try again.',
      error: error.message,
    });
  }
};

// @desc    Fetch device users
// @route   GET /api/attendance/device-users
// @access  Admin
export const fetchDeviceUsers = async (req: Request, res: Response) => {
  try {
    const users = await runWithDeviceLock(() => getDeviceUsers());
    res.status(200).json(users);
  } catch (error: any) {
    res.status(503).json({ message: 'Failed to fetch users from device', error: error.message });
  }
};

// @desc    Get active presence stats for dashboard
// @route   GET /api/attendance/active-today
// @access  Admin/HR
export const getActivePresence = async (req: Request, res: Response) => {
  try {
    // TEMPORARY DEMO FIX: Fetch the absolute latest 50 logs regardless of date
    const logs = await prisma.attendanceLog.findMany({
      take: 50,
      include: {
        user: {
          select: { name: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    const checkedIn = new Set();
    const checkedOut = new Set();

    const safeLogs = Array.isArray(logs) ? [...logs] : [];
    
    safeLogs.forEach((log: any) => {
      if (log.punchType === 'CheckIn') checkedIn.add(log.employeeId);
      if (log.punchType === 'CheckOut') checkedOut.add(log.employeeId);
    });

    const activeNow = Array.from(checkedIn).filter(id => !checkedOut.has(id)).length;

    const formattedRecent = safeLogs.slice(0, 5).map((log: any) => ({
      ...log,
      employeeName: log.user?.name || 'Unmapped User'
    }));

    res.status(200).json({
      totalToday: checkedIn.size,
      activeNow,
      recent: formattedRecent
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching presence stats', error: error.message });
  }
};

// @desc    Get all stored attendance logs from MongoDB
// @route   GET /api/attendance/logs
// @access  Admin
export const getAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', employeeId } = req.query;
    const currentUser = (req as any).user;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;

    // TEMPORARY DEMO FIX: Skipping role-based filtering so "Ultra Admin" or anyone can see all data
    /*
    const isAdmin = ['Admin', 'Super Admin', 'System Administrator'].includes(currentUser?.designation);
    if (!isAdmin) {
      where.employeeId = currentUser.id;
    }
    */

    // TEMPORARY DEMO FIX: Ignoring date filters and fetching the latest logs directly
    const [logs, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        skip,
        take,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { name: true, employeeId: true, department: true }
          }
        }
      }),
      prisma.attendanceLog.count({ where })
    ]);

    const formattedLogs = logs.map(log => ({
      ...log,
      employeeName: log.user?.name || 'Unmapped User',
      employeeRefId: log.user?.employeeId || log.employeeId
    }));

    res.status(200).json({ logs: formattedLogs, total, page: parseInt(page as string), limit: take });
  } catch (error: any) {
    console.error('❌ [getAttendanceLogs] Error:', error);
    res.status(500).json({ message: 'Error fetching attendance logs', error: error.message });
  }
};

// @desc    Create manual attendance record
// @route   POST /api/attendance/manual
// @access  Admin
export const createManualLog = async (req: Request, res: Response) => {
  try {
    const { employeeId, timestamp, punchType } = req.body;
    const currentUser = (req as any).user;
    const isAdmin = ['Admin', 'Super Admin', 'System Administrator'].includes(currentUser?.designation);
    const resolvedEmployeeId = !isAdmin ? currentUser.id : employeeId;

    if (!resolvedEmployeeId || !timestamp || !punchType) {
      return res.status(400).json({ message: 'Please provide employeeId, timestamp, and punchType' });
    }

    if (!['CheckIn', 'CheckOut'].includes(punchType)) {
      return res.status(400).json({ message: 'Punch type must be CheckIn or CheckOut' });
    }

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId: resolvedEmployeeId,
        timestamp: new Date(timestamp),
        punchType,
        deviceId: !isAdmin ? 'Mobile App' : 'Manual Entry'
      },
      include: {
        user: {
          select: { name: true, employeeId: true, department: true }
        }
      }
    });

    const logData = {
      ...log,
      employeeName: log.user?.name || 'Unknown'
    };

    // Broadcast the new manual punch to all connected clients (Dashboard Live Feed)
    const io = (global as any).io;
    if (io) {
      setImmediate(() => {
        io.emit('new-attendance', logData);
        io.emit('attendanceUpdate', { checkIn: punchType === 'CheckIn' });
        console.log(`[RealtimeService] 📡 Emitted manual software punch to frontend: ${logData.employeeName} [${punchType}]`);
      });
    }

    res.status(201).json({
      message: 'Manual entry created',
      log: logData
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating manual entry', error: error.message });
  }
};

// @desc    Webhook for standalone local device push script
// @route   POST /api/attendance/device-punch
// @access  Public
export const deviceWebhookPunch = async (req: Request, res: Response) => {
  try {
    // Check if the payload is an array of logs (batch processing)
    const isBatch = Array.isArray(req.body.logs);
    const logsToProcess = isBatch ? req.body.logs : [req.body];

    if (!logsToProcess.length) {
      return res.status(400).json({ message: 'No data provided' });
    }

    const processedLogs: any[] = [];
    const io = (global as any).io;

    for (const item of logsToProcess) {
      const { employeeId, timestamp, punchType, status } = item;
      
      if (!employeeId || !timestamp) {
        // Skip invalid entries in batch, or fail if single
        if (!isBatch) return res.status(400).json({ message: 'Missing employeeId or timestamp' });
        continue;
      }

      const parsedTimestamp = new Date(timestamp);
      const resolvedPunchType = punchType || status || 'CheckIn';

      // Find the user to ensure foreign key constraint is satisfied, only selecting necessary fields to avoid JSON parse errors
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ employeeId: String(employeeId) }, { id: String(employeeId) }]
        },
        select: { id: true, name: true }
      });

      if (!user) {
        const name = `User ${employeeId}`;
        const normalizedEmail = `user${employeeId}-${Date.now()}@hrm.test`;
        const hashedPassword = await bcrypt.hash('password123', 10);
        user = await prisma.user.create({
          data: {
            employeeId: String(employeeId),
            name,
            email: normalizedEmail,
            password: hashedPassword,
            baseSalary: 0,
            isActive: true,
            documents: {}
          },
          select: { id: true, name: true }
        });
      }

      const log = await prisma.attendanceLog.create({
        data: {
          employeeId: user.id,
          timestamp: parsedTimestamp,
          punchType: resolvedPunchType as any,
          deviceId: 'Webhook/Local Push'
        }
      });

      const logData = {
        ...log,
        employeeName: user.name
      };

      processedLogs.push(logData);

      if (io) {
        setImmediate(() => {
          io.emit('new-attendance', logData);
          io.emit('attendanceUpdate', { checkIn: resolvedPunchType === 'CheckIn' });
          console.log(`[RealtimeService] 📡 Emitted webhook punch: ${logData.employeeName} [${resolvedPunchType}]`);
        });
      }
    }

    res.status(201).json({ 
      success: true, 
      message: isBatch ? `Processed ${processedLogs.length} punches` : 'Punch recorded via webhook', 
      logs: processedLogs 
    });
  } catch (error: any) {
    console.error('[Webhook Error]:', error.message);
    res.status(500).json({ success: false, message: 'Failed to record punch', error: error.message });
  }
};
