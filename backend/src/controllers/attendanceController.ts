import { Request, Response } from 'express';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

// @desc    Legacy sync (used by cron job)
// @route   POST /api/attendance/sync
// @access  Admin
export const syncDeviceLogs = async (req: Request, res: Response) => {
  try {
    const newRecordsCount = await fetchDeviceLogs();
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
  res.status(200).json({
    message: 'Biometric sync started in the background. Please wait a few moments for the logs to populate.',
    status: 'processing'
  });

  // Background execution
  (async () => {
    try {
      console.log('[BackgroundSync] Starting full device sync...');
      await getDeviceAttendance();
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
  const result = await pingDevice();
  const status = result.reachable ? 200 : 503;
  res.status(status).json(result);
};

// @desc    Sync device users to Prisma DB
// @route   POST /api/attendance/sync-users
// @access  Admin
export const syncDeviceUsersToDB = async (req: Request, res: Response) => {
  try {
    const deviceUsers = await getDeviceUsers();
    let synced = 0;
    
    // Hash a default password
    const hashedPassword = await bcrypt.hash('123456', 10);

    for (const dUser of deviceUsers) {
      const employeeId = String(dUser.userId);
      await prisma.user.upsert({
        where: { employeeId },
        update: { name: dUser.name },
        create: {
          employeeId,
          name: dUser.name || `User ${employeeId}`,
          email: `${employeeId}@hrm.test`,
          password: hashedPassword,
          role: 'Executive',
          baseSalary: 0
        }
      });
      synced++;
    }

    res.status(200).json({ message: 'Users synced successfully', count: synced });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to sync users', error: error.message });
  }
};

// @desc    Fetch device users
// @route   GET /api/attendance/device-users
// @access  Admin
export const fetchDeviceUsers = async (req: Request, res: Response) => {
  try {
    const users = await getDeviceUsers();
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
      orderBy: { timestamp: 'desc' }
    });

    const checkedIn = new Set();
    const checkedOut = new Set();

    logs.forEach((log: any) => {
      if (log.punchType === 'CheckIn') checkedIn.add(log.employeeId);
      if (log.punchType === 'CheckOut') checkedOut.add(log.employeeId);
    });

    const activeNow = Array.from(checkedIn).filter(id => !checkedOut.has(id)).length;

    res.status(200).json({
      totalToday: checkedIn.size,
      activeNow,
      recent: logs.slice(0, 5)
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
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;

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
    const formattedLogs = logs.map((log: any) => ({
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

    if (!employeeId || !timestamp || !punchType) {
      return res.status(400).json({ message: 'Please provide employeeId, timestamp, and punchType' });
    }

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId,
        timestamp: new Date(timestamp),
        punchType,
        deviceId: 'Manual Entry'
      }
    });

    res.status(201).json({ message: 'Manual entry created', log });
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating manual entry', error: error.message });
  }
};
