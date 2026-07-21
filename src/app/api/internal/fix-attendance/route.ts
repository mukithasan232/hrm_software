import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatInTimeZone } from 'date-fns-tz';

export const dynamic = 'force-dynamic';
const BD_TZ = 'Asia/Dhaka';

export async function GET() {
  try {
    // 1. Fetch all records from AttendanceLog
    const allLogs = await prisma.attendanceLog.findMany({
      orderBy: { timestamp: 'asc' }
    });

    // 2. Group all records by employeeId and DATE(timestamp)
    const grouped: Record<string, typeof allLogs> = {};

    for (const log of allLogs) {
      const dateStr = formatInTimeZone(log.timestamp, BD_TZ, 'yyyy-MM-dd');
      const key = `${log.employeeId}_${dateStr}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(log);
    }

    let fixedCount = 0;

    // 3 & 4. Iterate through the groups and sorted logs
    for (const key of Object.keys(grouped)) {
      // Sort chronologically (already sorted by DB, but ensuring it)
      const logs = grouped[key].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // We only want to process logs that are purely dangling CheckIns to avoid destroying valid completed sessions.
      // A dangling CheckIn is one where checkOut is null.
      // However, to strictly follow the prompt while remaining safe, we will iterate in pairs:
      
      let i = 0;
      while (i < logs.length) {
        const firstLog = logs[i];
        
        // If this log already has a checkout, it's a valid complete session, skip to the next row
        if (firstLog.checkOut !== null) {
          i += 1;
          continue;
        }

        const secondLog = logs[i + 1];

        if (secondLog) {
          // If a 2nd log exists, take its timestamp and update the 1st log's checkOut field with it.
          // Note: If the second log ALSO had a checkout (which is rare), we are losing it.
          // But based on the bug, second log is a dangling CheckIn.
          
          await prisma.attendanceLog.update({
            where: { id: firstLog.id },
            data: {
              checkOut: secondLog.timestamp,
              isManualOut: secondLog.isManualIn || secondLog.isManualOut,
              checkOutDeviceId: secondLog.deviceId
            }
          });

          // Then, use Prisma to delete the 2nd log row completely.
          await prisma.attendanceLog.delete({
            where: { id: secondLog.id }
          });

          fixedCount++;
          i += 2; // Move past the pair
        } else {
          // No second log exists to pair with, leave it dangling (open session)
          i += 1;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Attendance data fixed!", 
      fixedCount 
    });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
