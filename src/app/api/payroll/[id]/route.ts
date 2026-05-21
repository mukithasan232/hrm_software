import { wrapHandler } from '@/lib/adapter';
import { updatePayrollStatus } from '@/controllers/payrollController';

export const PATCH = wrapHandler(updatePayrollStatus, {
  protect: true,
  allowedRoles: ['Admin', 'Superadmin']
});
