export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { createManualLog } from '@/controllers/attendanceController';

export const POST = wrapHandler(createManualLog, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'Employee']
});
