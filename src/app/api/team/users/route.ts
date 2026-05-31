import { wrapHandler, corsPreflight } from '@/lib/adapter';
import { getEmployees, createEmployee } from '@/controllers/userController';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(getEmployees, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator'],
});

export const POST = wrapHandler(createEmployee, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator'],
});
