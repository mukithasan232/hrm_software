export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { registerUser } from '@/controllers/authController';

export const POST = wrapHandler(registerUser);
