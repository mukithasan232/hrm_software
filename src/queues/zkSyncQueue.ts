import { prisma } from '../lib/prisma';
import { zkService } from '../services/zkService';

// Exponential backoff logic: 1min, 2min, 4min, 8min, 16min
const RETRY_DELAYS_MS = [
  1 * 60 * 1000,
  2 * 60 * 1000,
  4 * 60 * 1000,
  8 * 60 * 1000,
  16 * 60 * 1000,
];

/**
 * Processes a single sync job from the queue.
 */
async function processJob(job: { id: string; employeeId: string; retryCount: number }) {
  try {
    // 1. Fetch employee fresh from DB
    const employee = await prisma.user.findUnique({
      where: { id: job.employeeId }
    });

    if (!employee || !(employee as any).zktecoId) {
      throw new Error(`Employee ${job.employeeId} not found or missing enroll number.`);
    }

    // 2. Attempt Sync
    const syncResult = await zkService.syncUserToDevice({
      id: employee.id,
      zktecoId: (employee as any).zktecoId,
      name: employee.name,
      role: employee.designationId ? 0 : 0,
      password: '0'
    });

    // 3. Mark as completed
    await (prisma as any).zkSyncQueue.update({
      where: { id: job.id },
      data: { status: 'completed', updatedAt: new Date() }
    });

    // 4. Audit Log
    await (prisma as any).zkSyncLog.create({
      data: {
        employeeId: employee.id,
        enrollNumber: (employee as any).zktecoId,
        action: syncResult.action,
        status: 'success'
      }
    });

    console.log(`[ZK Queue] Job ${job.id} completed successfully.`);

  } catch (error: any) {
    const isOffline = error.name === 'ZKDeviceOfflineError' || error.message?.includes('Device offline');
    
    // If not offline, or we've exhausted retries, mark as failed
    if (!isOffline || job.retryCount >= RETRY_DELAYS_MS.length) {
      await markJobFailed(job, error.message || error.toString());
    } else {
      // It's offline, leave it as pending but increment retry.
      // Next pickup will happen automatically after delay (checked in poll method)
      await (prisma as any).zkSyncQueue.update({
        where: { id: job.id },
        data: {
          retryCount: job.retryCount + 1,
          lastError: error.message || 'Offline',
          updatedAt: new Date()
        }
      });
      console.warn(`[ZK Queue] Job ${job.id} failed (attempt ${job.retryCount + 1}). Retrying later.`);
    }
  }
}

async function markJobFailed(job: any, errorMessage: string) {
  await (prisma as any).zkSyncQueue.update({
    where: { id: job.id },
    data: { status: 'failed', lastError: errorMessage, updatedAt: new Date() }
  });

  console.error(`[ZK Queue] Job ${job.id} FAILED permanently after ${job.retryCount} retries. Error: ${errorMessage}`);
  
  // TODO: Send admin notification (email/webhook stub)
  // notifyAdmin(`ZKTeco Sync Failed for employee ${job.employeeId}: ${errorMessage}`);

  // Audit log the final failure
  try {
    const employee = await prisma.user.findUnique({ where: { id: job.employeeId } });
    if (employee && (employee as any).zktecoId) {
      await (prisma as any).zkSyncLog.create({
        data: {
          employeeId: job.employeeId,
          enrollNumber: (employee as any).zktecoId,
          action: 'unknown',
          status: 'failure',
          errorMessage: `Final failure after retries: ${errorMessage}`
        }
      });
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Polls the queue for pending jobs and processes them.
 * This should be called periodically by a cron job or interval.
 */
export async function processZkSyncQueue() {
  // console.log('[ZK Queue] Polling for pending jobs...');
  
  try {
    const pendingJobs = await (prisma as any).zkSyncQueue.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });

    for (const job of pendingJobs) {
      // Check if we should retry based on backoff delay
      const delayMs = RETRY_DELAYS_MS[Math.min(job.retryCount, RETRY_DELAYS_MS.length - 1)] || RETRY_DELAYS_MS[0];
      const nextAllowedRetry = new Date(job.updatedAt.getTime() + delayMs);
      
      if (new Date() >= nextAllowedRetry || job.retryCount === 0) {
        await processJob(job);
      }
    }
  } catch (error) {
    console.error('[ZK Queue] Error polling queue:', error);
  }
}
