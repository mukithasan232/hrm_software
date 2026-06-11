/**
 * clean-duplicates.ts
 * ───────────────────
 * One-time script to remove duplicate AttendanceLogs that were created
 * by the now-removed "+1ms timestamp padding" loop in zkService.ts.
 *
 * Strategy:
 *  - Group all logs by (employeeId + timestamp truncated to the minute)
 *  - Within each group, keep the EARLIEST record (lowest createdAt)
 *  - Delete the rest
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx prisma/clean-duplicates.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const dbUrl = new URL(process.env.DATABASE_URL || 'mysql://username:password@localhost:3306/hrm_database');
const poolConfig = {
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  connectionLimit: 5,
};

const adapter = new PrismaMariaDb(poolConfig);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔍 [clean-duplicates] Loading all attendance logs...');

  const allLogs = await prisma.attendanceLog.findMany({
    select: {
      id: true,
      employeeId: true,
      timestamp: true,
      createdAt: true,
      punchType: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  console.log(`📦 Total logs in DB: ${allLogs.length}`);

  // Group by (employeeId + minute-truncated timestamp)
  // Minute-truncation: floor to the minute, zero out seconds & ms
  const groups = new Map<string, typeof allLogs>();

  for (const log of allLogs) {
    const ts = new Date(log.timestamp);
    // Truncate to minute
    ts.setSeconds(0, 0);
    const key = `${log.employeeId}__${ts.getTime()}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(log);
  }

  const idsToDelete: string[] = [];

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    // Sort by createdAt ascending — keep the first (earliest insert)
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const [keep, ...duplicates] = group;
    console.log(
      `  ⚠️  Group "${key}": ${group.length} records. Keeping ${keep.id} [${keep.punchType}], deleting ${duplicates.length}.`
    );
    for (const dup of duplicates) {
      idsToDelete.push(dup.id);
    }
  }

  if (idsToDelete.length === 0) {
    console.log('\n✅ No duplicates found. Database is clean!');
    return;
  }

  console.log(`\n🗑️  Deleting ${idsToDelete.length} duplicate records in batches...`);

  // Delete in batches of 500 to avoid huge IN() queries
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += BATCH) {
    const batch = idsToDelete.slice(i, i + BATCH);
    const result = await prisma.attendanceLog.deleteMany({
      where: { id: { in: batch } },
    });
    deleted += result.count;
    console.log(`  → Batch ${Math.floor(i / BATCH) + 1}: deleted ${result.count}`);
  }

  console.log(`\n✅ Done! Deleted ${deleted} duplicate logs. Remaining: ${allLogs.length - deleted}`);
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
