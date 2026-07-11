import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';
import { formatInTimeZone } from 'date-fns-tz';

const BD_TZ = 'Asia/Dhaka';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');

    let startDate: Date;
    let endDate: Date;

    if (startParam && endParam) {
      startDate = new Date(startParam);
      endDate = new Date(endParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to last 7 days as requested by user if not provided
      const now = new Date();
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    const whereClause: any = {
      timestamp: {
        gte: startDate,
        lte: endDate
      },
      punchType: { contains: 'In' },
      user: { 
        isActive: true,
        ...(departmentId && departmentId !== 'ALL' && { departmentId })
      }
    };

    if (employeeId && employeeId !== 'ALL') {
      whereClause.employeeId = employeeId;
    }

    const checkIns = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            employeeId: true,
            designation: true,
            customDesignation: { select: { name: true } },
            shiftStartTime: true,
            shift: { select: { startTime: true } },
            customDepartment: { select: { name: true, shiftStartTime: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' } // Must be asc to get the first punch of the day
    });

    const lateRecords = [];
    const processedMap = new Set(); 
    const gracePeriodMs = 10 * 60 * 1000; // 10 minutes

    for (const log of checkIns) {
      if (!log.user) continue;

      const checkInLocalStr = formatInTimeZone(log.timestamp, BD_TZ, 'yyyy-MM-dd');
      const uniqueKey = `${log.employeeId}_${checkInLocalStr}`;
      
      // Process only the first check-in of the day
      if (processedMap.has(uniqueKey)) continue;
      processedMap.add(uniqueKey);

      const expectedShiftStart = log.user.shift?.startTime || log.user.shiftStartTime || log.user.customDepartment?.shiftStartTime || '09:00';
      const shiftStartLocalStr = `${checkInLocalStr}T${expectedShiftStart}:00+06:00`;
      const shiftStartUTC = new Date(shiftStartLocalStr);
      
      let lateMins = 0;
      if (log.timestamp.getTime() > shiftStartUTC.getTime() + gracePeriodMs) {
        lateMins = Math.floor((log.timestamp.getTime() - shiftStartUTC.getTime()) / 60000);
      }

      if (lateMins > 0) {
        lateRecords.push({
          id: log.id,
          date: checkInLocalStr,
          employeeName: log.user.name || 'Unknown',
          employeeId: log.user.employeeId,
          department: log.user.customDepartment?.name || 'Unassigned',
          shiftStart: expectedShiftStart,
          checkInTime: log.timestamp,
          lateMinutes: lateMins
        });
      }
    }

    // Sort the final late records descending by date
    lateRecords.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

    return NextResponse.json({ success: true, data: lateRecords });
  } catch (error: any) {
    console.error("Error fetching late report:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch late report' }, { status: 500 });
  }
}
