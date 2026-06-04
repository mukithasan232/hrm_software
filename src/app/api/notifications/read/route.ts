export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { markAsRead } from '@/controllers/notificationController';

export const POST = wrapHandler(markAsRead, {
  protect: true
});
