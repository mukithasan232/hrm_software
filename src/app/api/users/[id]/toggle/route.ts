import { wrapHandler } from '@/lib/adapter';
import { toggleEmployeeStatus } from '@/controllers/userController';

export const PATCH = wrapHandler(toggleEmployeeStatus, {
  protect: true,
  allowedRoles: ['Admin', 'Superadmin', 'HRM Manager']
});
