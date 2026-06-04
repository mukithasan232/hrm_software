export const dynamic = 'force-dynamic';

import { corsPreflight, wrapHandler } from '@/lib/adapter';
import { loginUser } from '@/controllers/authController';

export const OPTIONS = corsPreflight;
export const POST = wrapHandler(loginUser);
