import { wrapHandler } from '@/lib/adapter';
import { rateEmployee } from '@/controllers/performanceController';

export const POST = wrapHandler(rateEmployee, {
  protect: true,
  allowedRoles: ['Admin', 'Superadmin', 'HRM Manager']
});
