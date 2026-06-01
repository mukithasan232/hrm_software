import { wrapHandler } from '@/lib/adapter';
import { deviceWebhookPunch } from '@/controllers/attendanceController';

export const POST = wrapHandler(deviceWebhookPunch, {
  protect: false // Public endpoint for local webhook/scripts to push data to cloud
});
