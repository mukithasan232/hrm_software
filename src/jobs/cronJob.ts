import cron from 'node-cron';
import { syncZkTecoData } from '../services/zkService';

/**
 * Re-entrant lock — prevents a second cron tick from spawning a parallel
 * ZKTeco connection while the previous sync is still running.
 * If a sync takes > 60 s the next minute tick is simply skipped.
 */
let isSyncRunning = false;

export function initCronJobs() {
  console.log('[ZKCron] ⏱️  Initializing 1-minute background sync cron job...');

  // Run every 1 minute (* * * * *)
  cron.schedule('* * * * *', async () => {
    if (isSyncRunning) {
      console.warn('[ZKCron] ⚠️  Previous sync still running — skipping this tick to avoid parallel connections.');
      return;
    }

    isSyncRunning = true;
    const tickStart = Date.now();
    console.log(`[ZKCron] 🔄 Auto-sync started at ${new Date().toISOString()}`);

    try {
      // false = lightweight 3-day rolling window (not deep/full history sync)
      const result = await syncZkTecoData(false);
      const elapsed = ((Date.now() - tickStart) / 1000).toFixed(1);
      console.log(
        `[ZKCron] ✅ Auto-sync completed in ${elapsed}s — ` +
        `synced: ${result.synced} | skipped: ${result.skipped} | total device logs: ${result.total}`
      );
    } catch (error: any) {
      // IMPORTANT: never let an exception crash the cron scheduler.
      // Device offline / network timeout → log as warning and wait for next tick.
      const elapsed = ((Date.now() - tickStart) / 1000).toFixed(1);
      console.warn(
        `[ZKCron] ⚠️  Auto-sync failed after ${elapsed}s — will retry next minute. ` +
        `Reason: ${error?.message ?? String(error)}`
      );
    } finally {
      isSyncRunning = false;
    }
  });

  console.log('[ZKCron] ✅ Cron job registered — device will be polled every 1 minute.');
}
