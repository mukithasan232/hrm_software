export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { applyLeave } from '@/controllers/leaveController';

export const POST = wrapHandler(applyLeave, {
  protect: true,
  requiredPermissions: [{ moduleName: 'Leaves', action: 'canCreate' }]
});
