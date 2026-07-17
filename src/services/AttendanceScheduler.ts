import cron from 'node-cron';
// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';
import { AttendanceProcessor } from './AttendanceProcessor';
import { parseDeviceTime } from './zkService';

const ZK_TIMEOUT = 40000;
const ZK_INPORT = 0;

/**
 * Attendance Scheduler
 * 
 * Fetches raw logs from the ZKTeco device, stores them in RawDeviceLog,
 * and triggers the deterministic AttendanceProcessor.
 */
export class AttendanceScheduler {
  private static isRunning = false;

  /**
   * Initializes the CRON job to run every 5 minutes.
   */
  static start() {
    console.log('[AttendanceScheduler] 🕒 Initializing ZKTeco Cron Job (Runs every 5 minutes)');
    
    cron.schedule('*/5 * * * *', async () => {
      await this.runSyncTask();
    });
  }

  /**
   * The core synchronization task.
   * 1. Connects to ZK device.
   * 2. Fetches recent logs.
   * 3. Stores in RawDeviceLog (ignoring duplicates).
   * 4. Triggers AttendanceProcessor.
   */
  static async runSyncTask(isDeepSync: boolean = false) {
    if (this.isRunning) {
      console.log('[AttendanceScheduler] ⚠️ Sync task is already running, skipping this cycle.');
      return;
    }

    this.isRunning = true;
    let zk: any = null;

    try {
      console.log('[AttendanceScheduler] 🔄 Starting ZKTeco Sync Cycle...');

      // 1. Get active device config
      const device = await prisma.device.findFirst({ where: { isActive: true } });
      if (!device) {
        console.warn('[AttendanceScheduler] No active ZKTeco device configured.');
        return;
      }

      // 2. Initialize connection
      zk = new ZKLib(device.ipAddress, device.port || 4370, ZK_TIMEOUT, ZK_INPORT);
      zk.password = device.commKey || 0;
      zk.connectionType = 'tcp';

      try {
        await zk.createSocket();
      } catch (err) {
        zk.connectionType = 'udp';
        await zk.createSocket();
      }

      await new Promise(r => setTimeout(r, 1000));
      if (typeof zk.connect === 'function') {
        await Promise.race([
          zk.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 20000))
        ]);
      }
      
      console.log(`[AttendanceScheduler] 🔌 Connected to ${device.ipAddress} (${zk.connectionType})`);

      // 3. Fetch Attendances
      let rawLogs: any[] = [];
      let attempts = 3;
      while (attempts > 0) {
        try {
          const response = await zk.getAttendances();
          rawLogs = Array.isArray(response?.data) ? response.data : [];
          break;
        } catch (err: any) {
          if (err.message === 'zero' || err.message === 'zero length reply') {
            break;
          }
          if (attempts > 1) {
            await new Promise(r => setTimeout(r, 3000));
            attempts--;
            continue;
          }
          throw err;
        }
      }

      if (rawLogs.length === 0) {
        console.log('[AttendanceScheduler] No logs returned from device.');
      } else {
        // 4. Filter recent logs (last 3 days) unless deep sync
        const windowStart = new Date();
        if (!isDeepSync) {
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          threeDaysAgo.setHours(0, 0, 0, 0);
          windowStart.setTime(threeDaysAgo.getTime());
        } else {
           windowStart.setFullYear(2000, 0, 1);
        }

        const recentLogs = rawLogs.filter((log: any) => {
          const deviceTime = log.timestamp || log.recordTime || log.record_time;
          if (!deviceTime) return false;
          const rawTimestamp = parseDeviceTime(deviceTime);
          return rawTimestamp >= windowStart;
        });

        // 5. Store in RawDeviceLog
        const newRawInserts: any[] = [];
        
        for (const log of recentLogs) {
          const deviceEmpId = String(log.deviceUserId ?? log.user_id ?? log.userId ?? log.uid);
          const deviceTime = log.timestamp || log.recordTime || log.record_time;
          
          const rawTimestamp = parseDeviceTime(deviceTime);
          rawTimestamp.setMilliseconds(0);

          newRawInserts.push({
            deviceUserId: deviceEmpId,
            recordTime: rawTimestamp,
            punchType: log.punchType !== undefined && log.punchType !== null ? String(log.punchType) : null,
            ip: device.ipAddress,
          });
        }

        if (newRawInserts.length > 0) {
          const result = await prisma.rawDeviceLog.createMany({
            data: newRawInserts,
            skipDuplicates: true // Important: Prevents duplicate inserts
          });
          console.log(`[AttendanceScheduler] 🛡️ Inserted ${result.count} new punches into RawDeviceLog.`);
        }
      }

      // 6. Trigger processing regardless if we found new logs just now, 
      // in case there are pending raw logs from a failed previous run.
      await AttendanceProcessor.processAllPendingLogs();

    } catch (err: any) {
      console.error('[AttendanceScheduler] ❌ Sync Error:', err.message);
    } finally {
      // 7. Disconnect safely
      if (zk) {
        try {
          if (typeof zk.disconnect === 'function') {
            await zk.disconnect();
          } else if (typeof zk.free === 'function') {
            await zk.free();
          }
        } catch (e) {
          // ignore disconnect errors
        }
      }
      this.isRunning = false;
    }
  }
}
