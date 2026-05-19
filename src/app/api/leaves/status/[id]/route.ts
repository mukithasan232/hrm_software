import { wrapHandler } from '@/lib/adapter';
import { updateLeaveStatus } from '@/controllers/leaveController';

export const PATCH = wrapHandler(updateLeaveStatus, {
  protect: true,
  allowedRoles: ['HR', 'Manager', 'Admin']
});
