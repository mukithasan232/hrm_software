export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { generateMonthlyPayroll } from '@/controllers/payrollController';

export const POST = wrapHandler(generateMonthlyPayroll, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});
