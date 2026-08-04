import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.secret !== process.env.ZK_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Access global socket.io server initialized in server.cjs
    const io = (global as any).io;
    if (io) {
      io.emit('attendance_updated', body.newRecords);
      console.log('[Webhook] Emitted attendance_updated to frontend.');
    } else {
      console.warn('[Webhook] global.io is not available. Ensure server.cjs is running.');
    }
    
    // Invalidate dashboard and attendance caches
    revalidatePath('/dashboard');
    revalidatePath('/attendance');
    revalidatePath('/attendance/live');

    return NextResponse.json({ success: true, message: 'Next.js cache revalidated and socket event emitted.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
