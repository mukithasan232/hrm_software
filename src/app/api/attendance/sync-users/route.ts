import { wrapHandler } from '@/lib/adapter';
import { syncDeviceUsersToDB } from '@/controllers/attendanceController';

export const POST = wrapHandler(syncDeviceUsersToDB, {
  protect: true,
  adminOnly: true
});
