import cron from 'node-cron';
import { fetchDeviceLogs, processRawDeviceLogs } from '../services/zkService';
import { runWithDeviceLock } from '../services/realtimeService';
import { processZkSyncQueue } from '../queues/zkSyncQueue';

let isSyncing = false;

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

  console.log('⏰ Cron jobs initialized.');
};

