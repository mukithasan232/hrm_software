import type { Request, Response, NextFunction } from 'express-serve-static-core';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { runWithDeviceLock } from '../services/realtimeService';
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
    // Guard: prevent cloud‑to‑local direct sync in production
    if (process.env.NODE_ENV === 'production') {
      const ip = process.env.ZK_DEVICE_IP || '';
      const isLocal = ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.');
      if (isLocal) {
        return res.status(400).json({ message: 'Direct cloud-to-local sync is restricted. Please ensure the Office Sync Daemon is running to push data to the cloud.' });
      }
    }
    // Proceed with normal sync
    await runWithDeviceLock(() => getDeviceAttendance());
    res.status(200).json({ success: true, message: "Users and logs synced successfully to MariaDB" });
  } catch (error: any) {
    res.status(503).json({ message: 'Failed to sync users (biometric device offline or unreachable)', error: error.message });
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
    const tzOffset = 6 * 60 * 60 * 1000;
    const nowBD = new Date(new Date().getTime() + tzOffset);
    const year = nowBD.getUTCFullYear();
    const month = nowBD.getUTCMonth();
    const date = nowBD.getUTCDate();

    const startOfToday = new Date(Date.UTC(year, month, date - 1, 18, 0, 0, 0));
    const endOfToday = new Date(Date.UTC(year, month, date, 17, 59, 59, 999));

    const logs = await prisma.attendanceLog.findMany({
      where: {
        timestamp: { gte: startOfToday, lte: endOfToday }
      },
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
      employeeName: log.user?.name || `User ${log.employeeId}`
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
    const { page = '1', limit = '50', employeeId, startDate, endDate, range, filter } = req.query;
    const currentUser = (req as any).user;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;

    const isAdmin = ['Admin', 'Super Admin', 'System Administrator'].includes(currentUser?.designation);
    if (!isAdmin) {
      where.employeeId = currentUser.id;
    }

    const activeRange = (range || filter || 'today').toString().toLowerCase();

    // Handle Date Filtering
    if (activeRange === 'all-time') {
      // Do nothing, fetch everything
    } else if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    } else {
      // Range presets (Today, Yesterday, Week, Month) accurately calculated for GMT+6
      const tzOffset = 6 * 60 * 60 * 1000;
      const nowBD = new Date(new Date().getTime() + tzOffset);
      const year = nowBD.getUTCFullYear();
      const month = nowBD.getUTCMonth();
      const date = nowBD.getUTCDate();

      let start = new Date(Date.UTC(year, month, date - 1, 18, 0, 0, 0));
      let end = new Date(Date.UTC(year, month, date, 17, 59, 59, 999));

      if (activeRange === 'yesterday') {
        start = new Date(Date.UTC(year, month, date - 2, 18, 0, 0, 0));
        end = new Date(Date.UTC(year, month, date - 1, 17, 59, 59, 999));
      } else if (activeRange === 'week') {
        start = new Date(Date.UTC(year, month, date - 7, 18, 0, 0, 0));
      } else if (activeRange === 'month') {
        start = new Date(Date.UTC(year, month - 1, date, 18, 0, 0, 0));
      }

      where.timestamp = { gte: start, lte: end };
    }

    const [logs, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { name: true, employeeId: true, department: true }
          }
        }
      }),
      prisma.attendanceLog.count({ where })
    ]);

    // Map logs to include employee name from user relation
    const safeLogsList = Array.isArray(logs) ? [...logs] : [];
    const formattedLogs = safeLogsList.map((log: any) => ({
      ...log,
      employeeName: log.user?.name || 'Unknown'
    }));

    res.status(200).json({
      logs: formattedLogs,
      total,
      page: parseInt(page as string),
      pages: Math.ceil(total / take)
    });
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
    const { employeeId, timestamp, punchType, status } = req.body;
    
    if (!employeeId || !timestamp) {
      return res.status(400).json({ message: 'Missing employeeId or timestamp' });
    }

    const parsedTimestamp = new Date(timestamp);
    const resolvedPunchType = punchType || status || 'CheckIn';

    // Find the user to ensure foreign key constraint is satisfied
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ employeeId: String(employeeId) }, { id: String(employeeId) }]
      }
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
        }
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

    const io = (global as any).io;
    if (io) {
      setImmediate(() => {
        io.emit('new-attendance', logData);
        io.emit('attendanceUpdate', { checkIn: resolvedPunchType === 'CheckIn' });
        console.log(`[RealtimeService] 📡 Emitted webhook punch to frontend: ${logData.employeeName} [${resolvedPunchType}]`);
      });
    }

    res.status(201).json({ success: true, message: 'Punch recorded via webhook', log: logData });
  } catch (error: any) {
    console.error('[Webhook Error]:', error.message);
    res.status(500).json({ success: false, message: 'Failed to record punch', error: error.message });
  }
};
