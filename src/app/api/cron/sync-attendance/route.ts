import { NextRequest, NextResponse } from 'next/server';
import { syncZkTecoData } from '@/services/zkService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for cron execution

export async function GET(req: NextRequest) {
  try {
    // Optional: Protect via Vercel Cron Secret if configured in env
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the last 2 days strictly for background chron sync
    // This provides a buffer against midnight rollovers while being very lightweight
    const result = await syncZkTecoData(2);

    return NextResponse.json({
      message: 'Background cron sync completed successfully',
      result
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cron/Sync] Failed to execute background sync:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
