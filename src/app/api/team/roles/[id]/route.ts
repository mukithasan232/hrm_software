export const dynamic = 'force-dynamic';

import { corsPreflight, wrapHandler } from '@/lib/adapter';
import { updateRole, deleteRole } from '@/controllers/roleController';

export const OPTIONS = corsPreflight;

export const PUT = wrapHandler(updateRole, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});

export const DELETE = wrapHandler(deleteRole, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});
