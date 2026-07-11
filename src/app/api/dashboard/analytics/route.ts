export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { wrapHandler } from '@/lib/adapter';

const BD_TZ = 'Asia/Dhaka';

const getAnalytics = async (req: any, res: any) => {
  try {
    const user = (req as any).user;
    const userRole = user?.designation || '';
    const isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'HR'].includes(userRole);

    let totalEmployees = 1;
    if (isAdmin) {
      totalEmployees = await prisma.user.count({
        where: {
          isActive: true,
          userType: { not: 'SUPER_ADMIN' },
          email: { not: 'dev@fixanyphoto.com' },
          designation: {
            notIn: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager', 'HR', 'admin', 'super admin', 'system administrator', 'hrm manager', 'hr']
          }
        }
      });
    }

    const today = new Date();
    const analytics = [];

    // Collect the last 6 working days (Mon–Sat), skipping Sunday (dayOfWeek === 0)
    const WEEKEND_DAYS = [0]; // 0 = Sunday; add 6 for Saturday if needed
    const workingDays: Date[] = [];
    let daysBack = 0;
    while (workingDays.length < 6) {
      const candidate = subDays(today, daysBack);
      const dow = candidate.getDay(); // 0 = Sun, 6 = Sat
      if (!WEEKEND_DAYS.includes(dow)) {
        workingDays.push(candidate);
      }
      daysBack++;
      if (daysBack > 60) break; // safety guard
    }
    workingDays.reverse(); // oldest → newest

    for (const targetDate of workingDays) {
      const dateStr = formatInTimeZone(targetDate, BD_TZ, 'yyyy-MM-dd');
      const startUTC = new Date(`${dateStr}T00:00:00+06:00`);
      const endUTC = new Date(`${dateStr}T23:59:59.999+06:00`);

      const whereClause: any = {
        timestamp: { gte: startUTC, lte: endUTC },
        user: { employeeId: { not: 'UNMAPPED_FALLBACK' }, isActive: true }
      };

      if (!isAdmin && user?.id) {
        whereClause.employeeId = user.id;
      }

      const presentRecords = await prisma.attendanceLog.findMany({
        where: whereClause,
        distinct: ['employeeId'],
        select: { employeeId: true }
      });

      const present = presentRecords.length;
      const absent = totalEmployees - present;

      analytics.push({
        date: formatInTimeZone(targetDate, BD_TZ, 'EEE'), // Mon, Tue … Sat
        fullDate: dateStr,
        dayOfWeek: targetDate.getDay(),
        present,
        absent: absent > 0 ? absent : 0
      });
    }

    return res.status(200).json(analytics);
  } catch (error: any) {
    console.error('Analytics API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const GET = wrapHandler(getAnalytics, {
  protect: true,
  requiredPermissions: [{ moduleName: 'Attendance', action: 'canRead' }]
});
