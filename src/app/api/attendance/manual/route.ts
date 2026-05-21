import { wrapHandler } from '@/lib/adapter';
import { createManualLog } from '@/controllers/attendanceController';

export const POST = wrapHandler(createManualLog, {
  protect: true,
  allowedRoles: ['Admin', 'Superadmin', 'HRM Manager']
});
