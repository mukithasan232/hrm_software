import { wrapHandler } from '@/lib/adapter';
import { getActivePresence } from '@/controllers/attendanceController';

export const GET = wrapHandler(getActivePresence, {
  protect: true,
  allowedRoles: ['Admin', 'HR', 'Manager']
});
