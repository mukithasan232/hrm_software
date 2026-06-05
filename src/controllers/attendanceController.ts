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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. STRICT TODAY FILTER & UNIQUE EMPLOYEES
    const uniqueCheckInsToday = await prisma.attendanceLog.findMany({
      where: {
        timestamp: { gte: startOfToday, lte: endOfToday },
        punchType: 'CheckIn'
      },
      distinct: ['employeeId']
    });

    const uniqueCheckOutsToday = await prisma.attendanceLog.findMany({
      where: {
        timestamp: { gte: startOfToday, lte: endOfToday },
        punchType: 'CheckOut'
      },
      distinct: ['employeeId']
    });

    const checkedInIds = new Set(uniqueCheckInsToday.map((log: any) => log.employeeId));
    const checkedOutIds = new Set(uniqueCheckOutsToday.map((log: any) => log.employeeId));
    
    // An employee is active if they checked in but haven't checked out today
    const activeNow = Array.from(checkedInIds).filter(id => !checkedOutIds.has(id)).length;

    // 2. Fetch the absolute latest 50 logs STRICTLY FOR TODAY for the UI feed
    const logs = await prisma.attendanceLog.findMany({
      where: {
        timestamp: { gte: startOfToday, lte: endOfToday }
      },
      take: 50,
      include: {
        user: {
          select: { name: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    const safeLogs = Array.isArray(logs) ? [...logs] : [];
    
    // Return all up to 50 logs for today
    const formattedRecent = safeLogs.slice(0, 50).map((log: any) => ({
      ...log,
      employeeName: log.user?.name || 'Unmapped User'
    }));

    res.status(200).json({
      totalToday: checkedInIds.size,
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
    // 2. RAW DATA INSERTION: Support either { logs: [...] } or an array at the root, or single object
    const isBatch = Array.isArray(req.body.logs);
    let logsToProcess = isBatch ? req.body.logs : req.body;
    if (!Array.isArray(logsToProcess)) {
      logsToProcess = [logsToProcess];
    }

    if (!logsToProcess.length || !logsToProcess[0]) {
      return res.status(400).json({ message: 'No data provided' });
    }

    const processedLogs: any[] = [];
    const io = (global as any).io;

    // Temporary fix for corrupted MariaDB JSON fields
    if (req.body.command === 'fix_json') {
      try {
        await prisma.$executeRawUnsafe(`UPDATE User SET documents = '{}' WHERE documents = '' OR documents = '[object Object]' OR documents IS NULL`);
        await prisma.$executeRawUnsafe(`UPDATE Designation SET permissions = '{}' WHERE permissions = '' OR permissions = '[object Object]' OR permissions IS NULL`);
        await prisma.$executeRawUnsafe(`UPDATE User SET documents = '{}'`);
        return res.status(200).json({ success: true, message: 'Fixed JSON fields aggressively' });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }

    for (const item of logsToProcess) {
      try {
        // Map incoming ZKTeco fields correctly
        const deviceUserId = item.deviceUserId || item.userSn || item.employeeId;
        const recordTime = item.recordTime || item.timestamp;
        const punchType = item.punchType || item.status || 'CheckIn';
        const ip = item.ip || 'Webhook/Local Push';
        
        if (!deviceUserId || !recordTime) {
          console.warn('[Webhook] Missing deviceUserId or recordTime in log:', item);
          continue; // Skip invalid entries
        }

        const parsedTimestamp = new Date(recordTime);

        // Normalize deviceUserId variations for robust database matching
        const strId = String(deviceUserId).trim();
        const numId = !isNaN(Number(strId)) ? parseInt(strId, 10).toString() : strId;
        const paddedId2 = numId.padStart(2, '0'); // e.g., '5' -> '05'
        const paddedId3 = numId.padStart(3, '0'); // e.g., '26' -> '026'
        const empPrefix1 = `EMP${numId}`;         // 'EMP5'
        const empPrefix2 = `EMP${paddedId2}`;     // 'EMP05'
        const empPrefix3 = `EMP${paddedId3}`;     // 'EMP026'

        // Find the user to ensure foreign key constraint is satisfied
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { employeeId: strId },
              { employeeId: numId },
              { employeeId: paddedId2 },
              { employeeId: paddedId3 },
              { employeeId: empPrefix1 },
              { employeeId: empPrefix2 },
              { employeeId: empPrefix3 },
              { id: strId }
            ]
          },
          select: { id: true, name: true }
        });

        // ----------------------------------------------------
        // SMART CHECKIN / CHECKOUT DETECTION
        // ----------------------------------------------------
        const startOfDay = new Date(parsedTimestamp);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(parsedTimestamp);
        endOfDay.setHours(23, 59, 59, 999);

        let finalPunchType = 'CheckIn';
        const rawState = String(item.punchType || item.status || item.state).toLowerCase();
        
        // 1. If device sends explicit reliable CheckOut signals
        if (['1', '5', 'checkout', 'out'].includes(rawState)) {
          finalPunchType = 'CheckOut';
        } 
        // 2. If device sends explicit reliable CheckIn signals
        else if (['0', '4', 'checkin', 'in'].includes(rawState)) {
          finalPunchType = 'CheckIn';
        } 
        // 3. Fallback strictly to time-based logic by querying DB
        else {
          if (user) {
            const firstPunchToday = await prisma.attendanceLog.findFirst({
              where: {
                employeeId: user.id,
                timestamp: { gte: startOfDay, lte: endOfDay }
              },
              orderBy: { timestamp: 'asc' }
            });
            // If they already punched today, and it's NOT the exact same log being resynced
            if (firstPunchToday && firstPunchToday.timestamp.getTime() !== parsedTimestamp.getTime()) {
              finalPunchType = 'CheckOut';
            }
          } else {
            const firstRawPunch = await (prisma as any).rawDeviceLog.findFirst({
              where: {
                deviceUserId: String(deviceUserId),
                recordTime: { gte: startOfDay, lte: endOfDay }
              },
              orderBy: { recordTime: 'asc' }
            });
            // If raw punch already exists today, and it's NOT the exact same log being resynced
            if (firstRawPunch && new Date(firstRawPunch.recordTime).getTime() !== parsedTimestamp.getTime()) {
              finalPunchType = 'CheckOut';
            }
          }
        }

        // 3. HANDLE MISSING RELATIONS: Save as raw data instead of polluting Users table
        if (!user) {
          await (prisma as any).rawDeviceLog.upsert({
            where: {
              deviceUserId_recordTime: {
                deviceUserId: String(deviceUserId),
                recordTime: parsedTimestamp
              }
            },
            update: {
              punchType: finalPunchType,
              ip: String(ip)
            },
            create: {
              deviceUserId: String(deviceUserId),
              recordTime: parsedTimestamp,
              punchType: finalPunchType,
              ip: String(ip)
            }
          });
          console.log(`[Webhook] Saved raw punch for unknown deviceUserId: ${deviceUserId} [${finalPunchType}]`);
          continue; // Move to the next log
        }

        // 4. UPSERT / INSERT IGNORE for valid users based on unique combination of employeeId and timestamp
        const log = await prisma.attendanceLog.upsert({
          where: {
            employeeId_timestamp: {
              employeeId: user.id,
              timestamp: parsedTimestamp
            }
          },
          update: {
            punchType: finalPunchType,
            deviceId: String(ip)
          },
          create: {
            employeeId: user.id,
            timestamp: parsedTimestamp,
            punchType: finalPunchType,
            deviceId: String(ip)
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
            io.emit('attendanceUpdate', { checkIn: finalPunchType === 'CheckIn' });
            console.log(`[RealtimeService] 📡 Emitted webhook punch: ${logData.employeeName} [${finalPunchType}]`);
          });
        }
      } catch (insertError: any) {
        // 1. REMOVE SILENT FAILURES: Strict try/catch and log exact error
        console.error('❌ [Webhook] EXACT DB INSERT ERROR for log:', item, 'Error:', insertError);
        throw insertError; // Throw to be caught by outer block
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Processed ${processedLogs.length} valid punches successfully`, 
      logs: processedLogs 
    });
  } catch (error: any) {
    // Return 500 Internal Server Error
    console.error('❌ [Webhook Error - 500]:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error during database insertion', error: error.message || error });
  }
};
