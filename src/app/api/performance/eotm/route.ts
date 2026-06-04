export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { calculateEOTM } from '@/controllers/performanceController';

export const POST = wrapHandler(calculateEOTM, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager']
});
