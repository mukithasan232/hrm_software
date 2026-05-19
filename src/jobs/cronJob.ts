import cron from 'node-cron';
import { fetchDeviceLogs } from '../services/zkService';

export const initCronJobs = () => {
  // Schedule to run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🕒 Running periodic sync: Fetching ZKTeco Logs (Every 5 min)...');
    try {
      const syncedCount = await fetchDeviceLogs();
      console.log(`✅ Periodic sync completed. ${syncedCount} new logs fetched.`);
    } catch (error) {
      console.error('❌ Periodic sync failed.', error);
    }
  });


  console.log('⏰ Cron jobs initialized.');
};
