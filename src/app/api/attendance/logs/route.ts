export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { getAttendanceLogs } from '@/controllers/attendanceController';

export const GET = wrapHandler(getAttendanceLogs, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'Stakeholder', 'Employee']
});
