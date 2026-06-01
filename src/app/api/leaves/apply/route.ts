import { wrapHandler } from '@/lib/adapter';
import { applyLeave } from '@/controllers/leaveController';

export const POST = wrapHandler(applyLeave, {
  protect: true,
  allowedDesignations: ['Employee', 'HRM Manager', 'Stakeholder', 'Admin', 'Super Admin', 'System Administrator']
});
