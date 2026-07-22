export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { getLeaveBalance } from '@/controllers/leaveController';

export const GET = wrapHandler(getLeaveBalance, {
  protect: true
});
