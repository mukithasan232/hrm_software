export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { createAnnouncement, getAnnouncements, clearAnnouncements } from '@/controllers/announcementController';

// Only admins should create announcements
export const POST = wrapHandler(createAnnouncement, {
  protect: true,
  adminOnly: true
});

// All authenticated users can fetch their announcements
export const GET = wrapHandler(getAnnouncements, {
  protect: true,
  requiredPermissions: [{ moduleName: 'Announcements', action: 'canRead' }]
});

// Admins can clear all announcements
export const DELETE = wrapHandler(clearAnnouncements, {
  protect: true,
  adminOnly: true
});
