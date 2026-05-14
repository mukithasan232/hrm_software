import cron from 'node-cron';
import { fetchDeviceLogs } from '../services/zkService';

export const initCronJobs = () => {
  // Schedule to run every day at 11:50 PM server time
  cron.schedule('50 23 * * *', async () => {
    console.log('🕒 Running daily cron job: Fetching ZKTeco Logs...');
    try {
      await fetchDeviceLogs();
      console.log('✅ Daily cron job completed successfully.');
    } catch (error) {
      console.error('❌ Daily cron job failed.', error);
    }
  });

  console.log('⏰ Cron jobs initialized.');
};
