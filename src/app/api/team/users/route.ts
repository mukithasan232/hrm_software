export const dynamic = 'force-dynamic';

import { wrapHandler, corsPreflight } from '@/lib/adapter';
import { getEmployees, createEmployee } from '@/controllers/userController';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(getEmployees, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});

export const POST = wrapHandler(createEmployee, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});
