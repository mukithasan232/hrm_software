import cron from 'node-cron';
import { fetchDeviceLogs, processRawDeviceLogs } from '../services/zkService';
import { runWithDeviceLock } from '../services/realtimeService';
import { processZkSyncQueue } from '../queues/zkSyncQueue';

import { prisma } from '../lib/prisma'; // Ensure prisma is imported for DB access

let isSyncing = false;
let isAutoCheckoutRunning = false;

async function runSmartAutoCheckout() {
  if (isAutoCheckoutRunning) return;
  isAutoCheckoutRunning = true;
  console.log('🤖 [Cron] Running Smart Auto-Checkout...');
  try {
    const latestLogs = await prisma.attendanceLog.findMany({
      orderBy: { timestamp: 'desc' },
      distinct: ['employeeId'],
      include: { user: { include: { customDepartment: true, shift: true } } }
    });
    
    // Only process employees whose absolute latest punch was a CheckIn
    const activeSessions = latestLogs.filter((log: any) => log.punchType === 'CheckIn');
    const now = Date.now();

    let processedCount = 0;
    for (const log of activeSessions) {
      const checkInTime = log.timestamp.getTime();
      const hoursSinceCheckIn = (now - checkInTime) / (1000 * 60 * 60);

      const shiftEndTimeStr = log.user?.shift?.endTime || log.user?.shiftEndTime || log.user?.customDepartment?.shiftEndTime;

      if (shiftEndTimeStr) {
        // Shift-Aware Trigger
        const [hour, min] = shiftEndTimeStr.split(':').map(Number);
        // Shift to +06:00 to match local time used in BD
        const tzOffset = 6 * 60 * 60 * 1000;
        const localDate = new Date(log.timestamp.getTime() + tzOffset);
        const dateStr = localDate.toISOString().split('T')[0];
        
        let shiftEndUTC = new Date(`${dateStr}T${shiftEndTimeStr}:00+06:00`);
        
        // If shift end is before check-in time (e.g. night shift), move shift end to next day
        if (shiftEndUTC.getTime() < checkInTime) {
          shiftEndUTC = new Date(shiftEndUTC.getTime() + 24 * 60 * 60 * 1000);
        }

        const autoCheckOutThreshold = shiftEndUTC.getTime() + (4 * 60 * 60 * 1000); // 4 hour grace period

        if (now > autoCheckOutThreshold) {
          const correctOutTimestamp = new Date(checkInTime + (8 * 60 * 60 * 1000));
          await prisma.attendanceLog.create({
            data: {
              employeeId: log.employeeId,
              timestamp: correctOutTimestamp,
              punchType: 'CheckOut',
              deviceId: 'System Auto-Checkout'
            }
          });
          processedCount++;
        }
      } else {
        // Duration-Aware Trigger (Fallback to 16 hours)
        if (hoursSinceCheckIn > 16) {
          const autoCheckOutTime = new Date(checkInTime + 8 * 60 * 60 * 1000); // Default 8 hours
          await prisma.attendanceLog.create({
            data: {
              employeeId: log.employeeId,
              timestamp: autoCheckOutTime,
              punchType: 'CheckOut',
              deviceId: 'System Auto-Checkout'
            }
          });
          processedCount++;
        }
      }
    }
    if (processedCount > 0) {
      console.log(`✅ [Cron] Smart Auto-Checkout processed ${processedCount} orphaned sessions.`);
    }
  } catch (error) {
    console.error('❌ [Cron] Smart Auto-Checkout failed.', error);
  } finally {
    isAutoCheckoutRunning = false;
  }
}

export const initCronJobs = () => {
  // Schedule to run every 1 minute
  cron.schedule('* * * * *', async () => {
    if (isSyncing) {
      console.log('⚠️ [Cron] Sync already in progress, aborting this minute\'s trigger.');
      return;
    }
    
    isSyncing = true;
    console.log('🕒 [Cron] Running periodic sync: Fetching ZKTeco Logs (Every 1 min)...');
    try {
      const syncedCount = await runWithDeviceLock(() => fetchDeviceLogs());
      console.log(`✅ [Cron] Periodic sync completed. ${syncedCount} new logs fetched.`);
    } catch (error) {
      // Graceful error handling: silent fail in background if offline
      console.log('⚠️ [Cron] Periodic sync skipped: Device unreachable or offline.');
    } finally {
      isSyncing = false;
    }
  });

  // Offline queue processor for User Sync & Raw Logs Mapping (Runs every 1 minute)
  cron.schedule('* * * * *', async () => {
    try {
      await processZkSyncQueue();
    } catch (error) {
      console.error('❌ Offline Queue processing failed.', error);
    }
    
    try {
      await processRawDeviceLogs();
    } catch (error) {
      console.error('❌ Raw Device Log processing failed.', error);
    }
  });

  // Smart Auto-Checkout (Runs every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    await runSmartAutoCheckout();
  });

  console.log('⏰ Cron jobs initialized.');
};

