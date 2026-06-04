export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { toggleEmployeeStatus } from '@/controllers/userController';

export const PATCH = wrapHandler(toggleEmployeeStatus, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});
