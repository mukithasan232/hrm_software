export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { wrapHandler } from '@/lib/adapter';
import { getActivePresence } from '@/controllers/attendanceController';

export const GET = wrapHandler(getActivePresence, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'Stakeholder', 'Employee']
});
