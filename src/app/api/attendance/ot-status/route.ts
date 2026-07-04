import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  try {
    const { userId, date, otStatus } = await req.json();

    if (!userId || !date || !otStatus) {
      return NextResponse.json({ error: "Missing required fields (userId, date, otStatus)." }, { status: 400 });
    }

    // Parse the date (e.g., '2026-07-04')
    const targetDate = parseISO(date);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    // Fetch records first to calculate approvedOtMinutes if APPROVED
    const records = await prisma.attendanceLog.findMany({
      where: {
        employeeId: userId,
        timestamp: {
          gte: start,
          lte: end,
        }
      }
    });

    if (records.length === 0) {
      return NextResponse.json({ error: "Could not locate underlying records for this date." }, { status: 404 });
    }

    // Calculate total valid hours for the day to determine OT minutes
    // We group them just like the frontend controller does
    let firstCheckIn = null;
    let lastCheckOut = null;

    for (const log of records) {
      if (log.punchType === 'CheckIn') {
        if (!firstCheckIn || log.timestamp < firstCheckIn.timestamp) {
          firstCheckIn = log;
        }
      } else if (log.punchType === 'CheckOut') {
        if (!lastCheckOut || log.timestamp > lastCheckOut.timestamp) {
          lastCheckOut = log;
        }
      }
    }

    let approvedMinutes = 0;
    if (otStatus === 'APPROVED' && firstCheckIn && lastCheckOut && lastCheckOut.timestamp > firstCheckIn.timestamp) {
      const totalMs = lastCheckOut.timestamp.getTime() - firstCheckIn.timestamp.getTime();
      const standardShiftMs = 8 * 60 * 60 * 1000; // 8 Hours
      const otMs = Math.max(0, totalMs - standardShiftMs);
      approvedMinutes = Math.floor(otMs / 60000);
    }

    // Update all punch records for this user on this specific date
    const updated = await prisma.attendanceLog.updateMany({
      where: {
        employeeId: userId,
        timestamp: {
          gte: start,
          lte: end,
        }
      },
      data: {
        otStatus: otStatus,
        approvedOtMinutes: approvedMinutes
      }
    });

    return NextResponse.json({ message: "Overtime status updated successfully.", count: updated.count });
  } catch (error: any) {
    console.error("OT UPDATE ERROR:", error);
    return NextResponse.json({ error: "Internal server error during OT update." }, { status: 500 });
  }
}
