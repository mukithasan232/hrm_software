import { wrapHandler } from '@/lib/adapter';
import { loginUser } from '@/controllers/authController';

export const POST = wrapHandler(loginUser);
