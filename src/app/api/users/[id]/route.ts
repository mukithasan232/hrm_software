import { wrapHandler } from '@/lib/adapter';
import { updateEmployee, deleteEmployee, toggleEmployeeStatus } from '@/controllers/userController';

export const PUT = wrapHandler(updateEmployee, {
  protect: true,
  allowedRoles: ['Admin', 'HR']
});

export const DELETE = wrapHandler(deleteEmployee, {
  protect: true,
  allowedRoles: ['Admin', 'HR']
});

export const PATCH = wrapHandler(toggleEmployeeStatus, {
  protect: true,
  allowedRoles: ['Admin', 'HR']
});
