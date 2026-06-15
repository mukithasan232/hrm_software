import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function healAllHistoricalData() {
  console.log('🚀 Starting full database healing process...');
  
  try {
    // 1. Fetch ALL attendance logs
    const logs = await prisma.attendanceLog.findMany({
      orderBy: { timestamp: 'asc' },
    });

    console.log(`📦 Fetched ${logs.length} total attendance logs.`);

    // 2. Group by employeeId AND local Date string (YYYY-MM-DD)
    const groupedLogs: Record<string, typeof logs> = {};
    const tzOffset = 6 * 60 * 60 * 1000; // UTC+6

    for (const log of logs) {
      const localDate = new Date(log.timestamp.getTime() + tzOffset);
      const dateKey = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth() + 1}-${localDate.getUTCDate()}`;
      const key = `${log.employeeId}_${dateKey}`;

      if (!groupedLogs[key]) {
        groupedLogs[key] = [];
      }
      groupedLogs[key].push(log);
    }

    console.log(`🔄 Processing ${Object.keys(groupedLogs).length} unique employee days...`);

    let updatedCount = 0;

    // 3. Update punchTypes: strictly toggle CheckIn / CheckOut
    for (const key in groupedLogs) {
      const list = groupedLogs[key];
      if (list.length === 0) continue;

      let currentExpected = 'CheckIn';

      for (let i = 0; i < list.length; i++) {
        const log = list[i];

        if (log.punchType !== currentExpected) {
          await prisma.attendanceLog.update({
            where: { id: log.id },
            data: { punchType: currentExpected },
          });
          updatedCount++;
        }

        // Toggle for next record on the same day
        currentExpected = currentExpected === 'CheckIn' ? 'CheckOut' : 'CheckIn';
      }
    }

    console.log(`✅ Healing complete! Corrected ${updatedCount} records.`);
  } catch (error) {
    console.error('❌ Error during healing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

healAllHistoricalData();
