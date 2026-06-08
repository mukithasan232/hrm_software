import cron from 'node-cron';
import { fetchDeviceLogs } from '../services/zkService';
import { runWithDeviceLock } from '../services/realtimeService';
import { processZkSyncQueue } from '../queues/zkSyncQueue';

export const initCronJobs = () => {
  // Schedule to run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🕒 Running periodic sync: Fetching ZKTeco Logs (Every 5 min)...');
    try {
      const syncedCount = await runWithDeviceLock(() => fetchDeviceLogs());
      console.log(`✅ Periodic sync completed. ${syncedCount} new logs fetched.`);
    } catch (error) {
      console.error('❌ Periodic sync failed.', error);
    }
  });

  // Offline queue processor for User Sync (Runs every 1 minute)
  cron.schedule('* * * * *', async () => {
    try {
      await processZkSyncQueue();
    } catch (error) {
      console.error('❌ Offline Queue processing failed.', error);
    }
  });

  console.log('⏰ Cron jobs initialized.');
};

