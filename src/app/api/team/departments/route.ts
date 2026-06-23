export const dynamic = 'force-dynamic';

import { corsPreflight } from '@/lib/adapter';
import { wrapHandler } from '@/lib/adapter';
import { getDepartments, createDepartment } from '@/controllers/departmentController';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(getDepartments, {
  protect: true,
});

export const POST = wrapHandler(createDepartment, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'],
});
