import { wrapHandler } from '@/lib/adapter';
import { getAllPayrolls } from '@/controllers/payrollController';

export const GET = wrapHandler(getAllPayrolls, {
  protect: true,
  allowedRoles: ['Admin', 'HR']
});
