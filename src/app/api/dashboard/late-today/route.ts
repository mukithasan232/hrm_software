import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lateLogs = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: today,
          lt: tomorrow
        },
        type: 'IN',
        lateMinutes: {
          gt: 0
        }
      },
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
            designation: true,
            customDesignation: { select: { name: true } }
          }
        }
      },
      orderBy: {
        lateMinutes: 'desc'
      }
    });

    const lateEmployees = lateLogs.map(log => ({
      id: log.id,
      name: log.user?.name || 'Unknown',
      avatar: log.user?.profileImage || null,
      designation: log.user?.customDesignation?.name || log.user?.designation || 'Employee',
      lateMinutes: log.lateMinutes
    }));

    return NextResponse.json({ success: true, data: lateEmployees });
  } catch (error: any) {
    console.error("Error fetching late today:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch late employees' }, { status: 500 });
  }
}
