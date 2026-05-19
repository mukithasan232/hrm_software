import { wrapHandler } from '@/lib/adapter';
import { getNotifications } from '@/controllers/notificationController';

export const GET = wrapHandler(getNotifications, {
  protect: true
});
