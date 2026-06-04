export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { seedTestUser } from '@/controllers/userController';

export const POST = wrapHandler(seedTestUser);
