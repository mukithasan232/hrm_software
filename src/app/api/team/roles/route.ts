export const dynamic = 'force-dynamic';

import { corsPreflight } from '@/lib/adapter';
import { wrapHandler } from '@/lib/adapter';
import { getRoles, createRole } from '@/controllers/roleController';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(getRoles, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});

export const POST = wrapHandler(createRole, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
});
