export const dynamic = 'force-dynamic';

import { wrapHandler } from '@/lib/adapter';
import { deviceWebhookPunch } from '@/controllers/attendanceController';

export const POST = async (req: Request, ctx: any) => {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const EXPECTED_TOKEN = process.env.API_SECRET_TOKEN || 'my_secret_token_2026';
  
  if (authHeader !== `Bearer ${EXPECTED_TOKEN}`) {
    console.warn(`[Webhook Error]: Unauthorized access attempt with token: ${authHeader}`);
    return new Response(
      JSON.stringify({ success: false, message: 'Unauthorized Hacker!' }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const handler = wrapHandler(deviceWebhookPunch, { protect: false });
  return handler(req as any, ctx);
};
