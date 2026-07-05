import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAutoCheckouts() {
  console.log('🔍 Starting Auto-Checkout timestamp fix...');
  try {
    // 1. Fetch all Auto-Checkout logs
    const autoCheckouts = await prisma.attendanceLog.findMany({
      where: {
        deviceId: 'System Auto-Checkout',
        punchType: 'CheckOut'
      },
      orderBy: { timestamp: 'asc' }
    });

    console.log(`Found ${autoCheckouts.length} System Auto-Checkout records.`);

    let fixedCount = 0;

    for (const checkOutLog of autoCheckouts) {
      // 2. Find the immediately preceding CheckIn for this employee
      const checkInLog = await prisma.attendanceLog.findFirst({
        where: {
          employeeId: checkOutLog.employeeId,
          punchType: 'CheckIn',
          timestamp: { lte: checkOutLog.timestamp }
        },
        orderBy: { timestamp: 'desc' }
      });

      if (checkInLog) {
        const inTime = checkInLog.timestamp.getTime();
        const outTime = checkOutLog.timestamp.getTime();

        const durationMs = outTime - inTime;
        const eightHoursMs = 8 * 60 * 60 * 1000;
        
        // If the duration is significantly different from 8 hours (e.g., > 14 hours)
        // or if they are on completely different calendar days but shouldn't be
        if (durationMs > 12 * 60 * 60 * 1000 || durationMs < 0) {
          console.log(`⚠️ Fixing corrupted checkout for employee ${checkOutLog.employeeId}. Original Diff: ${Math.round(durationMs/3600000)}h`);
          
          const correctOutTimestamp = new Date(inTime + eightHoursMs);

          await prisma.attendanceLog.update({
            where: { id: checkOutLog.id },
            data: { timestamp: correctOutTimestamp }
          });
          fixedCount++;
        }
      }
    }

    console.log(`✅ Successfully fixed ${fixedCount} corrupted auto-checkout timestamps.`);
  } catch (error) {
    console.error('❌ Error fixing auto-checkouts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAutoCheckouts();
