/**
 * prisma/delete-corrupted.ts
 * 
 * Task 3: Database Cleanup
 * Run this script to delete all attendance logs that were corrupted by the 
 * "Sync Time" bug (where the timestamp was exactly the time of the script running).
 * 
 * Usage:
 *   npx tsx prisma/delete-corrupted.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Searching for corrupted logs (mass duplicates at exact same second)...');

  // Find all logs inserted today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysLogs = await prisma.attendanceLog.findMany({
    where: {
      createdAt: { gte: startOfToday },
      deviceId: { not: 'Manual Entry' }
    },
    select: {
      id: true,
      timestamp: true
    }
  });

  // Group by exact timestamp
  const timestampCounts = new Map<number, string[]>();
  for (const log of todaysLogs) {
    const timeMs = log.timestamp.getTime();
    if (!timestampCounts.has(timeMs)) timestampCounts.set(timeMs, []);
    timestampCounts.get(timeMs)!.push(log.id);
  }

  let totalDeleted = 0;

  // If more than 5 logs share the EXACT same millisecond timestamp, 
  // it is mathematically impossible for humans and indicates the script bug.
  for (const [timeMs, ids] of timestampCounts) {
    if (ids.length > 5) {
      console.log(`⚠️ Found ${ids.length} corrupted logs all sharing timestamp: ${new Date(timeMs).toISOString()}`);
      
      const res = await prisma.attendanceLog.deleteMany({
        where: { id: { in: ids } }
      });
      totalDeleted += res.count;
      console.log(`✅ Deleted ${res.count} corrupted logs.`);
    }
  }

  if (totalDeleted === 0) {
    console.log('🎉 No corrupted mass-sync timestamps found.');
  } else {
    console.log(`\n✅ Successfully purged ${totalDeleted} corrupted logs. You can now run a fresh sync from the dashboard.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
