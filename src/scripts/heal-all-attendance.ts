import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function healAllData() {
  console.log('🏥 Starting attendance data healing...');
  try {
    const tzOffset = 6 * 60 * 60 * 1000;

    // Fetch all logs ordered by employee and timestamp
    const logs = await prisma.attendanceLog.findMany({
      orderBy: { timestamp: 'asc' },
    });

    // Group logs by employeeId and local date (Dhaka time)
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

    // Process each group (each employee's day)
    for (const groupKey in groupedLogs) {
      const list = groupedLogs[groupKey];
      if (list.length === 0) continue;

      for (let i = 0; i < list.length; i++) {
        const log = list[i];
        
        // Manual Entries keep their existing state
        if (log.deviceId === 'Manual Entry') continue;

        // Odd count (index 0, 2, 4...) -> CheckIn
        // Even count (index 1, 3, 5...) -> CheckOut
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

    console.log(`✅ Healing complete. Updated ${updatedCount} records.`);
  } catch (error) {
    console.error('❌ Error healing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

healAllData();
