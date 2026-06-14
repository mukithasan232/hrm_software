import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Attendance History Data Healing...');
  
  // 1. Fetch all attendance logs ordered by employeeId and timestamp
  const logs = await prisma.attendanceLog.findMany({
    orderBy: [
      { employeeId: 'asc' },
      { timestamp: 'asc' },
    ],
  });

  console.log(`Fetched ${logs.length} total attendance logs.`);

  const tzOffset = 6 * 60 * 60 * 1000;
  
  // Group by employeeId -> dateStr -> logs
  const grouped = new Map<string, any[]>();
  
  for (const log of logs) {
    const localDate = new Date(log.timestamp.getTime() + tzOffset);
    const dateStr = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth() + 1}-${localDate.getUTCDate()}`;
    const key = `${log.employeeId}_${dateStr}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(log);
  }

  console.log(`Grouped into ${grouped.size} daily employee sessions.`);

  let updatedCount = 0;

  for (const [key, sessionLogs] of grouped.entries()) {
    let expectedType = 'CheckIn';
    
    for (const log of sessionLogs) {
      if (log.punchType !== expectedType) {
        await prisma.attendanceLog.update({
          where: { id: log.id },
          data: { punchType: expectedType },
        });
        updatedCount++;
      }
      
      // Toggle expectation
      expectedType = expectedType === 'CheckIn' ? 'CheckOut' : 'CheckIn';
    }
  }

  console.log(`Healing complete! Updated ${updatedCount} logs.`);
}

main()
  .catch((e) => {
    console.error('Error during data healing:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
