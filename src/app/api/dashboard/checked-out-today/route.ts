import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';
import { formatInTimeZone } from 'date-fns-tz';

const BD_TZ = 'Asia/Dhaka';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkOuts = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: today,
          lt: tomorrow
        },
        punchType: { in: ['Check Out', 'Check-Out', 'Out'] },
        user: { isActive: true }
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
      orderBy: { timestamp: 'desc' }
    });

    const checkedOutEmployees = [];
    const processedEmployees = new Set();

    for (const log of checkOuts) {
      if (!log.user) continue;
      
      // Only keep the most recent check-out for the day per employee
      if (processedEmployees.has(log.employeeId)) {
        continue;
      }
      processedEmployees.add(log.employeeId);

      checkedOutEmployees.push({
        id: log.id,
        name: log.user.name || 'Unknown',
        avatar: log.user.profileImage || null,
        designation: log.user.customDesignation?.name || log.user.designation || 'Employee',
        checkOutTime: log.timestamp
      });
    }

    return NextResponse.json({ success: true, data: checkedOutEmployees });
  } catch (error: any) {
    console.error("Error fetching checked-out today:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch checked-out employees' }, { status: 500 });
  }
}
