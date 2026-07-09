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

    const checkIns = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: today,
          lt: tomorrow
        },
        punchType: { contains: 'In' },
        user: { isActive: true }
      },
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
            designation: true,
            customDesignation: { select: { name: true } },
            shiftStartTime: true,
            shift: { select: { startTime: true } },
            customDepartment: { select: { shiftStartTime: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    const lateEmployees = [];
    const processedEmployees = new Set();
    const gracePeriodMs = 10 * 60 * 1000; // 10 minutes

    for (const log of checkIns) {
      if (!log.user) continue;
      
      // FIX: Only calculate late minutes for the FIRST session of the day
      if (processedEmployees.has(log.employeeId)) {
        continue;
      }
      processedEmployees.add(log.employeeId);

      const expectedShiftStart = log.user.shift?.startTime || log.user.shiftStartTime || log.user.customDepartment?.shiftStartTime || '09:00';
      const checkInLocalStr = formatInTimeZone(log.timestamp, BD_TZ, 'yyyy-MM-dd');
      const shiftStartLocalStr = `${checkInLocalStr}T${expectedShiftStart}:00+06:00`;
      const shiftStartUTC = new Date(shiftStartLocalStr);
      
      let lateMins = 0;
      if (log.timestamp.getTime() > shiftStartUTC.getTime() + gracePeriodMs) {
        lateMins = Math.floor((log.timestamp.getTime() - shiftStartUTC.getTime()) / 60000);
      }

      if (lateMins > 0) {
        lateEmployees.push({
          id: log.id,
          name: log.user.name || 'Unknown',
          avatar: log.user.profileImage || null,
          designation: log.user.customDesignation?.name || log.user.designation || 'Employee',
          lateMinutes: lateMins
        });
      }
    }

    lateEmployees.sort((a, b) => b.lateMinutes - a.lateMinutes);

    return NextResponse.json({ success: true, data: lateEmployees });
  } catch (error: any) {
    console.error("Error fetching late today:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch late employees' }, { status: 500 });
  }
}
