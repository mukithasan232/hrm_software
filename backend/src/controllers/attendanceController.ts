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
    res.status(200).json({ count: users.length, users });
  } catch (error: any) {
    res.status(503).json({ message: 'Failed to fetch device users', error: error.message });
  }
};

// @desc    Get all stored attendance logs from MongoDB
// @route   GET /api/attendance/logs
// @access  Admin
export const getAttendanceLogs = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', employeeId, startDate, endDate, range } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;

    // Handle Date Filtering
    if (range === 'all-time') {
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
      // Range presets (Today, Yesterday, Week, Month)
      const tzOffset = 6 * 60 * 60 * 1000; // +06:00
      const todayLocal = new Date(new Date().getTime() + tzOffset).toISOString().split('T')[0];
      
      const start = new Date(`${todayLocal}T00:00:00+06:00`);
      const end = new Date(`${todayLocal}T23:59:59.999+06:00`);

      if (range === 'yesterday') {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
      } else if (range === 'week') {
        start.setDate(start.getDate() - 7);
      } else if (range === 'month') {
        start.setMonth(start.getMonth() - 1);
      } else {
        // Default: Today (already set)
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
            select: { name: true }
          }
        }
      }),
      prisma.attendanceLog.count({ where }),
    ]);

    const formattedLogs = logs.map((log: any) => ({
      id: log.id,
      employeeId: log.employeeId,
      timestamp: log.timestamp,
      punchType: log.punchType,
      deviceId: log.deviceId,
      employeeName: log.user?.name || 'N/A'
    }));

    res.status(200).json({ total, page: parseInt(page as string), logs: formattedLogs });
  } catch (error: any) {
    console.error('❌ [getAttendanceLogs] Prisma Error:', error);
    res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
  }
};

// @desc    Create manual attendance log
// @route   POST /api/attendance/manual
// @access  Admin/HR
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

    res.status(201).json({ message: 'Manual log created successfully', log });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create manual log', error: error.message });
  }
};
