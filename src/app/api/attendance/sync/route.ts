import { wrapHandler } from '@/lib/adapter';
import { syncDeviceLogs } from '@/controllers/attendanceController';

export const POST = wrapHandler(syncDeviceLogs, {
  protect: true,
  adminOnly: true
});
