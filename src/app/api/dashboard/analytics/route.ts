export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { wrapHandler } from '@/lib/adapter';

const BD_TZ = 'Asia/Dhaka';

const getAnalytics = async () => {
  try {
    const totalEmployees = await prisma.user.count({
      where: {
        isActive: true,
        userType: 'Employee'
      }
    });

    const today = new Date();
    const analytics = [];

    // Fetch distinct attendances grouped by day for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const targetDate = subDays(today, i);
      const dateStr = formatInTimeZone(targetDate, BD_TZ, 'yyyy-MM-dd');
      const startUTC = new Date(`${dateStr}T00:00:00+06:00`);
      const endUTC = new Date(`${dateStr}T23:59:59.999+06:00`);

      const presentRecords = await prisma.attendanceLog.findMany({
        where: {
          timestamp: { gte: startUTC, lte: endUTC },
          user: { employeeId: { not: 'UNMAPPED_FALLBACK' } }
        },
        distinct: ['employeeId'],
        select: { employeeId: true }
      });

      const present = presentRecords.length;
      const absent = totalEmployees - present;

      analytics.push({
        date: formatInTimeZone(targetDate, BD_TZ, 'EEE'), // Mon, Tue
        fullDate: dateStr,
        present,
        absent: absent > 0 ? absent : 0
      });
    }

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Analytics API Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
};

export const GET = wrapHandler(getAnalytics, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'Owner', 'Manager', 'Employee']
});
