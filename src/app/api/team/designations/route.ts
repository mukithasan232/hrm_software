import { corsPreflight } from '@/lib/adapter';
import { wrapHandler } from '@/lib/adapter';
import { getDesignations, createDesignation } from '@/controllers/designationController';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(getDesignations, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator'],
});

export const POST = wrapHandler(createDesignation, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator'],
});
