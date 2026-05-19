import { wrapHandler } from '@/lib/adapter';
import { getLeaves } from '@/controllers/leaveController';

export const GET = wrapHandler(getLeaves, {
  protect: true
});
