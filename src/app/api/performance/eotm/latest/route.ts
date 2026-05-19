import { wrapHandler } from '@/lib/adapter';
import { getLatestEOTM } from '@/controllers/performanceController';

export const GET = wrapHandler(getLatestEOTM, {
  protect: true
});
