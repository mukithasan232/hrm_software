import { wrapHandler, corsPreflight } from '@/lib/adapter';
import { updateDesignation, deleteDesignation } from '@/controllers/designationController';

export const OPTIONS = corsPreflight;

export const PUT = wrapHandler(updateDesignation, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator'],
});

export const DELETE = wrapHandler(deleteDesignation, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator'],
});
