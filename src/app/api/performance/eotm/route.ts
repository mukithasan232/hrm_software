import { wrapHandler } from '@/lib/adapter';
import { calculateEOTM } from '@/controllers/performanceController';

export const POST = wrapHandler(calculateEOTM, {
  protect: true,
  allowedRoles: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});
