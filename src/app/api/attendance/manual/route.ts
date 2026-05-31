import { wrapHandler } from '@/lib/adapter';
import { createManualLog } from '@/controllers/attendanceController';

export const POST = wrapHandler(createManualLog, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'Employee']
});
