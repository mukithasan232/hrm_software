export const dynamic = 'force-dynamic';

import { corsPreflight } from '@/lib/adapter';
import { wrapHandler } from '@/lib/adapter';
import { getDesignations, createDesignation } from '@/controllers/designationController';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(getDesignations, {
  protect: true,
});

export const POST = wrapHandler(createDesignation, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});
