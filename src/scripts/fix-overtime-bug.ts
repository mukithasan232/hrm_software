import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOvertimeBug() {
  console.log('🔍 Scanning for astronomical Overtime bugs (>24h duration)...');
  try {
    // 1. Fetch all CheckIn logs
    const checkIns = await prisma.attendanceLog.findMany({
      where: { punchType: 'CheckIn' },
      orderBy: { timestamp: 'asc' }
    });

    let fixedCount = 0;

    for (const checkIn of checkIns) {
      // 2. Find the immediately following CheckOut
      const checkOut = await prisma.attendanceLog.findFirst({
        where: {
          employeeId: checkIn.employeeId,
          punchType: 'CheckOut',
          timestamp: { gte: checkIn.timestamp }
        },
        orderBy: { timestamp: 'asc' }
      });

      if (checkOut) {
        // Make sure there isn't another CheckIn between this CheckIn and CheckOut
        const intermediateCheckIn = await prisma.attendanceLog.findFirst({
          where: {
            employeeId: checkIn.employeeId,
            punchType: 'CheckIn',
            timestamp: { gt: checkIn.timestamp, lt: checkOut.timestamp }
          }
        });

        if (!intermediateCheckIn) {
          const durationMs = checkOut.timestamp.getTime() - checkIn.timestamp.getTime();
          
          // If duration > 24 hours (86,400,000 ms)
          if (durationMs > 24 * 60 * 60 * 1000) {
            console.log(`⚠️ Found astronomical overtime for ${checkIn.employeeId}. Duration: ${Math.round(durationMs / 3600000)}h`);
            
            // Force CheckOut to be CheckIn + 8 hours
            const correctOutTimestamp = new Date(checkIn.timestamp.getTime() + (8 * 60 * 60 * 1000));

            await prisma.attendanceLog.update({
              where: { id: checkOut.id },
              data: { timestamp: correctOutTimestamp }
            });

            fixedCount++;
          }
        }
      }
    }

    console.log(`✅ Successfully capped ${fixedCount} records exceeding 24h.`);
  } catch (error) {
    console.error('❌ Error fixing overtime bug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOvertimeBug();
