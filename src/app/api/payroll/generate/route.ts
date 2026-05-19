import { wrapHandler } from '@/lib/adapter';
import { generateMonthlyPayroll } from '@/controllers/payrollController';

export const POST = wrapHandler(generateMonthlyPayroll, {
  protect: true,
  allowedRoles: ['Admin', 'HR']
});
