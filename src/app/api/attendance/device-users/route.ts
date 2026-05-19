import { wrapHandler } from '@/lib/adapter';
import { fetchDeviceUsers } from '@/controllers/attendanceController';

export const GET = wrapHandler(fetchDeviceUsers, {
  protect: true,
  adminOnly: true
});
