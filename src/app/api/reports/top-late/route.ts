import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';
import { formatInTimeZone } from 'date-fns-tz';

const BD_TZ = 'Asia/Dhaka';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || '3';
    const limit = parseInt(limitParam, 10) || 3;
    
    // Default to this month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const checkIns = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        punchType: { contains: 'In' },
        user: { isActive: true }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            profileImage: true,
            customDesignation: { select: { name: true } },
            shiftStartTime: true,
            shift: { select: { startTime: true } },
            customDepartment: { select: { name: true, shiftStartTime: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    const lateCounts: Record<string, any> = {};
    const processedMap = new Set(); 
    const gracePeriodMs = 15 * 60 * 1000; // 15 minutes strict rule

    for (const log of checkIns) {
      if (!log.user) continue;

      const checkInLocalStr = formatInTimeZone(log.timestamp, BD_TZ, 'yyyy-MM-dd');
      const uniqueKey = `${log.employeeId}_${checkInLocalStr}`;
      
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
        const empId = log.user.id;
        if (!lateCounts[empId]) {
          lateCounts[empId] = {
            id: empId,
            name: log.user.name,
            employeeId: log.user.employeeId,
            avatar: log.user.profileImage || null,
            designation: log.user.customDesignation?.name || 'Unassigned',
            department: log.user.customDepartment?.name || 'Unassigned',
            lateCount: 0,
            totalLateMinutes: 0
          };
        }
        lateCounts[empId].lateCount += 1;
        lateCounts[empId].totalLateMinutes += lateMins;
      }
    }

    const topLatePersons = Object.values(lateCounts)
      .sort((a, b) => b.lateCount - a.lateCount || b.totalLateMinutes - a.totalLateMinutes)
      .slice(0, limit);

    return NextResponse.json({ success: true, data: topLatePersons });
  } catch (error: any) {
    console.error("Error fetching top late report:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch top late report' }, { status: 500 });
  }
}
