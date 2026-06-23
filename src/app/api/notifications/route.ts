export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { getNotifications, markAsRead, deleteNotifications } from '@/controllers/notificationController';

export const GET = wrapHandler(getNotifications, {
  protect: true
});

export const PATCH = wrapHandler(markAsRead, {
  protect: true
});

export const DELETE = wrapHandler(deleteNotifications, {
  protect: true
});
