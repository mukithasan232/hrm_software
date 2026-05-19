import { wrapHandler } from '@/lib/adapter';
import { getEmployees, createEmployee } from '@/controllers/userController';

export const GET = wrapHandler(getEmployees, {
  protect: true,
  allowedRoles: ['Admin', 'HR', 'Manager']
});

export const POST = wrapHandler(createEmployee, {
  protect: true,
  allowedRoles: ['Admin', 'HR']
});
