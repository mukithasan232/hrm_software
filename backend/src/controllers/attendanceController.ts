import { Request, Response } from 'express';
import { getDeviceAttendance, getDeviceUsers, pingDevice, fetchDeviceLogs } from '../services/zkService';
import { AttendanceLog } from '../models/AttendanceLog';
import { User } from '../models/User';

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
  const startedAt = new Date();
  try {
    const { synced, skipped, total } = await getDeviceAttendance();

    // 2. Try to also pull device users and match against our DB
    let matchedUsers: { deviceId: string; dbName?: string }[] = [];
    try {
      const deviceUsers = await getDeviceUsers();
      const employeeList = await User.find().select('employeeId name');

      matchedUsers = deviceUsers.map((du: any) => {
        const match = employeeList.find(e => e.employeeId === String(du.userId));
        return { deviceId: String(du.userId), dbName: match?.name };
      });
    } catch (_) {
      // Non-fatal — attendance was already synced
    }

    const finishedAt = new Date();
    const duration = ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2);

    res.status(200).json({
      message: `Live sync complete in ${duration}s`,
      stats: { total, synced, skipped },
      matchedUsers,
      syncedAt: finishedAt,
    });
  } catch (error: any) {
    res.status(503).json({
      message: 'Device sync failed',
      error: error.message,
      tip: 'Ensure the device is powered on and reachable at 192.168.10.185:4370',
    });
  }
};

// @desc    Ping the ZKTeco device
// @route   GET /api/attendance/device-status
// @access  Admin
export const getDeviceStatus = async (req: Request, res: Response) => {
  const result = await pingDevice();
  const status = result.reachable ? 200 : 503;
  res.status(status).json(result);
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
    const { page = '1', limit = '50', employeeId } = req.query;
    const filter: any = {};
    if (employeeId) filter.employeeId = employeeId;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [logs, total] = await Promise.all([
      AttendanceLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit as string)),
      AttendanceLog.countDocuments(filter),
    ]);

    res.status(200).json({ total, page: parseInt(page as string), logs });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch logs', error: error.message });
  }
};
