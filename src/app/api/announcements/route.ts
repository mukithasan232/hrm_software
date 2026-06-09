export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { createAnnouncement, getAnnouncements } from '@/controllers/announcementController';

// Only admins should create announcements
export const POST = wrapHandler(createAnnouncement, {
  protect: true,
  adminOnly: true
});

// All authenticated users can fetch their announcements
export const GET = wrapHandler(getAnnouncements, {
  protect: true,
  allowedDesignations: ['Employee', 'HRM Manager', 'Stakeholder', 'Admin', 'Super Admin', 'System Administrator']
});
