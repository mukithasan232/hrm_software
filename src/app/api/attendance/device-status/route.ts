import { wrapHandler } from '@/lib/adapter';
import { getDeviceStatus } from '@/controllers/attendanceController';

export const GET = wrapHandler(getDeviceStatus, {
  protect: true,
  adminOnly: true
});
