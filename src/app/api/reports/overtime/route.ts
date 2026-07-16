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

    let startDate: Date;
    let endDate: Date;

    if (startParam && endParam) {
      startDate = new Date(startParam);
      endDate = new Date(endParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const checkIns = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        punchType: { contains: 'In' },
        checkOut: { not: null },
        user: { isActive: true }
      },
      include: {
        user: {
          select: {
            name: true,
            employeeId: true,
            customDesignation: true,
            customDesignation: { select: { name: true } },
            shiftEndTime: true,
            shift: { select: { endTime: true } },
            customDepartment: { select: { name: true, shiftEndTime: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    const overtimeData = [];
    let totalPending = 0;
    let totalApprovedMinutes = 0;

    for (const log of checkIns) {
      try {
        const user = log.user;
        if (!user) continue;

        let targetEndTimeStr = '17:00';

        if (user.shiftEndTime && user.shiftEndTime.includes(':')) {
          targetEndTimeStr = user.shiftEndTime;
        } else if (user.shift?.endTime && user.shift.endTime.includes(':')) {
          targetEndTimeStr = user.shift.endTime;
        } else if (user.customDepartment?.shiftEndTime && user.customDepartment.shiftEndTime.includes(':')) {
          targetEndTimeStr = user.customDepartment.shiftEndTime;
        }

        const checkOutDate = new Date(log.checkOut!);
        const dateStr = formatInTimeZone(checkOutDate, BD_TZ, 'yyyy-MM-dd');
        
        const [endHour, endMin] = targetEndTimeStr.split(':').map(Number);
        
        const shiftEndTarget = new Date(`${dateStr}T${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00+06:00`);
        
        const diffMs = checkOutDate.getTime() - shiftEndTarget.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes > 30 || log.otStatus !== 'PENDING') {
          const calculatedMinutes = diffMinutes > 0 ? diffMinutes : 0;
          const actualOtMinutes = log.otStatus === 'APPROVED' ? log.approvedOtMinutes : calculatedMinutes;

          if (log.otStatus === 'PENDING') totalPending++;
          if (log.otStatus === 'APPROVED') totalApprovedMinutes += actualOtMinutes;

          overtimeData.push({
            id: log.id,
            date: log.timestamp,
            employeeName: user.name || 'Unknown',
            employeeId: user.employeeId || 'N/A',
            department: user.customDepartment?.name || user.customDesignation?.name || user.designation || 'Unknown',
            shiftEnd: targetEndTimeStr,
            checkOutTime: log.checkOut,
            calculatedOtMinutes: calculatedMinutes,
            approvedOtMinutes: log.approvedOtMinutes || 0,
            otStatus: log.otStatus || 'PENDING',
          });
        }
      } catch (err) {
        console.error('Error processing log', log.id, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: overtimeData,
      summary: {
        totalPending,
        totalApprovedMinutes
      }
    });

  } catch (error: any) {
    console.error('Failed to fetch overtime data:', error);
    try {
      require('fs').appendFileSync('/Users/tushar/Documents/office_work/hrm_software /error.log', JSON.stringify({ message: error?.message, stack: error?.stack }) + '\n');
    } catch(e) {}
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error?.message || String(error) 
    }, { status: 500 });
  }
}
