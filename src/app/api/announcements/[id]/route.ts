export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { deleteAnnouncement } from '@/controllers/announcementController';

// Only admins should delete individual announcements
export const DELETE = wrapHandler(deleteAnnouncement, {
  protect: true,
  adminOnly: true
});
