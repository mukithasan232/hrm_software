import { NextResponse } from 'next/server';
import { syncZkTecoData } from '@/services/zkService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    // Rebuild the last 30 days of data for zero-touch architecture
    console.log('[Deep Sync] Initiating absolute deep sync (fetching all history)...');
    const result = await syncZkTecoData(true);

    return NextResponse.json({
      message: 'Deep sync completed successfully',
      result
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Deep Sync] Failed to execute deep sync:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
