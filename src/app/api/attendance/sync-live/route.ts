export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { syncLive } from '@/controllers/attendanceController';

export const POST = wrapHandler(syncLive, {
  protect: true,
  adminOnly: true
});
