import { wrapHandler } from '@/lib/adapter';
import { getProfile, updateProfile } from '@/controllers/userController';

export const GET = wrapHandler(getProfile, {
  protect: true
});

export const PUT = wrapHandler(updateProfile, {
  protect: true
});
