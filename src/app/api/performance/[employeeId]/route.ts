export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { getPerformanceStats } from '@/controllers/performanceController';

export const GET = wrapHandler(getPerformanceStats, {
  protect: true
});
