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
            employeeType: true,
            customDesignation: { select: { name: true } },
            shiftStartTime: true,
            remoteShiftStartTime: true,
            shift: { select: { startTime: true, remoteShiftStartTime: true } },
            customDepartment: { select: { shiftStartTime: true, remoteShiftStartTime: true } }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    const lateEmployees = [];
    const processedEmployees = new Set();
    for (const log of checkIns) {
      if (!log.user) continue;
      
      // FIX: Only calculate late minutes for the FIRST session of the day
      if (processedEmployees.has(log.employeeId)) {
        continue;
      }
      processedEmployees.add(log.employeeId);

      let expectedShiftStart = log.user.shift?.startTime || log.user.shiftStartTime || log.user.customDepartment?.shiftStartTime || '09:00';
      if (log.user.employeeType === 'Hybrid') {
        if (log.deviceId === 'MANUAL_WEB' || log.isManualIn) {
          expectedShiftStart = log.user.shift?.remoteShiftStartTime || log.user.remoteShiftStartTime || log.user.customDepartment?.remoteShiftStartTime || expectedShiftStart;
        }
      } else if (log.workMode === 'REMOTE' || log.deviceId === 'MANUAL_WEB') {
        expectedShiftStart = log.user.shift?.remoteShiftStartTime || log.user.remoteShiftStartTime || log.user.customDepartment?.remoteShiftStartTime || expectedShiftStart;
      }

      const checkInLocalStr = formatInTimeZone(log.timestamp, BD_TZ, 'yyyy-MM-dd');
      const shiftStartLocalStr = `${checkInLocalStr}T${expectedShiftStart}:00+06:00`;
      const shiftStartUTC = new Date(shiftStartLocalStr);
      
      const diffMs = log.timestamp.getTime() - shiftStartUTC.getTime();
      let lateMins = 0;
      if (diffMs >= 60000) { // strictly 1 minute or more
        lateMins = Math.floor(diffMs / 60000);
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
