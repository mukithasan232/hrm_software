import cron from 'node-cron';
import { syncZkTecoData } from '../services/zkService';

export function initCronJobs() {
  console.log("⏱️ Initializing Docker-native background sync cron job...");
  
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log("🔄 Running scheduled ZKTeco Background Sync...");
      // Fetch only the last 3 days for lightweight continuous syncing
      await syncZkTecoData(3); 
      console.log("✅ Scheduled Sync Completed.");
    } catch (error) {
      console.error("❌ Cron Sync Error:", error);
    }
  });
}
