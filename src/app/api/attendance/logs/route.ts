import { wrapHandler } from '@/lib/adapter';
import { getAttendanceLogs } from '@/controllers/attendanceController';

export const GET = wrapHandler(getAttendanceLogs, {
  protect: true,
  allowedRoles: ['Admin', 'Superadmin', 'HRM Manager', 'Stakeholder']
});
