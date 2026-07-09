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
    const activeSessions = await prisma.attendanceLog.findMany({ 
      where: { 
        checkOut: null,
        punchType: { contains: 'in' } // Ensure we only target check-ins
      } 
    });
    
    const now = Date.now();
    const MAX_SESSION_MS = 12 * 60 * 60 * 1000; // Strictly 12 Hours Max Session
    let processedCount = 0;

    for (const session of activeSessions) {
      const inTime = session.timestamp.getTime();
      
      if (now - inTime > MAX_SESSION_MS) {
        const cappedOutTime = new Date(inTime + MAX_SESSION_MS);
        
        await prisma.attendanceLog.update({
          where: { id: session.id },
          data: {
            checkOut: cappedOutTime,
            // otStatus could be explicitly set if we wanted, but we'll let the dashboard recalculate valid hours
          }
        });
        processedCount++;
      }
    }
    
    if (processedCount > 0) {
      console.log(`✅ [Cron] Smart Auto-Checkout processed and capped ${processedCount} sessions at exactly 12 hours.`);
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

