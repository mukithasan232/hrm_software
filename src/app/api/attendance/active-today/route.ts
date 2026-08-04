export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandler } from '@/lib/adapter';
import { getActivePresence } from '@/controllers/attendanceController';

const baseHandler = wrapHandler(getActivePresence, {
  protect: true,
  requiredPermissions: [{ moduleName: 'Attendance', action: 'canRead' }]
});

export async function GET(req: NextRequest, ctx: any) {
  const response = await baseHandler(req, ctx);
  // Force no-cache on the response
  if (response instanceof NextResponse || response instanceof Response) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    return new NextResponse(response.body, { status: response.status, headers });
  }
  return response;
}
