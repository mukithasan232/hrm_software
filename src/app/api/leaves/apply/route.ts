import { wrapHandler } from '@/lib/adapter';
import { applyLeave } from '@/controllers/leaveController';

export const POST = wrapHandler(applyLeave, {
  protect: true,
  allowedRoles: ['Employee', 'HRM Manager', 'Stakeholder', 'Admin', 'Superadmin']
});
