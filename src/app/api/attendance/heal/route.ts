import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tzOffset = 6 * 60 * 60 * 1000; // Dhaka Time Offset

    const logs = await prisma.attendanceLog.findMany({
      orderBy: { timestamp: 'asc' },
    });

    const groupedLogs: Record<string, typeof logs> = {};

    for (const log of logs) {
      const localDate = new Date(log.timestamp.getTime() + tzOffset);
      const dateKey = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth() + 1}-${localDate.getUTCDate()}`;
      const groupKey = `${log.employeeId}_${dateKey}`;

      if (!groupedLogs[groupKey]) {
        groupedLogs[groupKey] = [];
      }
      groupedLogs[groupKey].push(log);
    }

    let updatedCount = 0;

    for (const groupKey in groupedLogs) {
      const list = groupedLogs[groupKey];
      if (list.length === 0) continue;

      for (let i = 0; i < list.length; i++) {
        const log = list[i];
        
        if (log.deviceId === 'Manual Entry') continue;

        const expectedPunch = i % 2 === 0 ? 'CheckIn' : 'CheckOut';

        if (log.punchType !== expectedPunch) {
          await prisma.attendanceLog.update({
            where: { id: log.id },
            data: { punchType: expectedPunch as any },
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Healing complete. Updated ${updatedCount} records.`,
      updatedCount
    });

  } catch (error: any) {
    console.error('Error healing data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
