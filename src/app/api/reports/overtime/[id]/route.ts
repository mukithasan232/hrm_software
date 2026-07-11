import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/config/db';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { action, approvedOtMinutes } = await request.json();
    const { id } = await params;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: 'Missing id or action' }, { status: 400 });
    }

    let otStatus = 'PENDING';
    let finalMinutes = 0;

    if (action === 'APPROVE') {
      otStatus = 'APPROVED';
      finalMinutes = approvedOtMinutes || 0;
    } else if (action === 'REJECT') {
      otStatus = 'REJECTED';
      finalMinutes = 0;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const updatedLog = await prisma.attendanceLog.update({
      where: { id },
      data: {
        otStatus,
        approvedOtMinutes: finalMinutes
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedLog
    });

  } catch (error) {
    console.error('Failed to update overtime status:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
