import { wrapHandler } from '@/lib/adapter';
import { updateLeaveStatus } from '@/controllers/leaveController';

export const PATCH = wrapHandler(updateLeaveStatus, {
  protect: true,
  allowedRoles: ['HRM Manager', 'Admin', 'Super Admin', 'System Administrator']
});
