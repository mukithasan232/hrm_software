export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { getEmployees, createEmployee } from '@/controllers/userController';

export const GET = wrapHandler(getEmployees, {
  protect: true
});

export const POST = wrapHandler(createEmployee, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});
