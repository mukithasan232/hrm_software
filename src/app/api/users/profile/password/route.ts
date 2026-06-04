export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { changePassword } from '@/controllers/userController';

export const PUT = wrapHandler(changePassword, {
  protect: true
});
