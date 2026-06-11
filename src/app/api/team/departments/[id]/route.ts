export const dynamic = 'force-dynamic';

import { corsPreflight } from '@/lib/adapter';
import { wrapHandler } from '@/lib/adapter';
import { updateDepartment, deleteDepartment } from '@/controllers/departmentController';

export const OPTIONS = corsPreflight;

export const PUT = wrapHandler(updateDepartment, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'],
});

export const DELETE = wrapHandler(deleteDepartment, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'],
});
