export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { updateEmployee, deleteEmployee, toggleEmployeeStatus } from '@/controllers/userController';

export const PUT = wrapHandler(updateEmployee, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});

export const DELETE = wrapHandler(deleteEmployee, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});

export const PATCH = wrapHandler(toggleEmployeeStatus, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});
