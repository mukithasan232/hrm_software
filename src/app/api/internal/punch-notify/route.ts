import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.API_SECRET_TOKEN || 'local_fallback_token';
    
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const io = (global as any).io;
    if (io) {
      io.emit('attendanceUpdate', { checkIn: true });
      return NextResponse.json({ success: true, message: 'Dashboard notified' });
    } else {
      return NextResponse.json({ success: false, message: 'Socket.io not initialized' });
    }
  } catch (error: any) {
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
