/**
 * prisma/clean-db.ts
 * ──────────────────
 * Emergency database sanitization script. Run ONCE as an admin after discovering
 * ghost data from 2025 and millisecond-jitter duplicates that bypassed the
 * @@unique([employeeId, timestamp]) constraint.
 *
 * What it does (in order):
 *  Phase 1 — Purge pre-go-live ghost data
 *    Delete all AttendanceLog records where timestamp < GO_LIVE_DATE.
 *    Defaults to 2026-01-01 00:00:00 UTC. Override with GO_LIVE_DATE env var.
 *
 *  Phase 2 — Deduplicate by employee + minute
 *    Group all remaining logs by (employeeId, timestamp rounded to the minute).
 *    Within each group, keep the EARLIEST record (lowest createdAt).
 *    Delete the rest. This handles the millisecond-jitter bypass case where
 *    10:19:18.000 and 10:19:18.432 were saved as two separate rows.
 *
 * Safe to re-run — it is idempotent.
 *
 * Usage:
 *   npx tsx prisma/clean-db.ts
 *
 *   # Override go-live date (ISO string):
 *   GO_LIVE_DATE="2026-04-01" npx tsx prisma/clean-db.ts
 *
 *   # Dry run (log actions, delete nothing):
 *   DRY_RUN=true npx tsx prisma/clean-db.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// ── Config ────────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN === 'true';
const GO_LIVE_DATE = new Date(process.env.GO_LIVE_DATE || '2026-01-01T00:00:00.000Z');

if (isNaN(GO_LIVE_DATE.getTime())) {
  console.error('❌ Invalid GO_LIVE_DATE:', process.env.GO_LIVE_DATE);
  process.exit(1);
}

// ── Prisma Setup ──────────────────────────────────────────────────────────────
const rawDbUrl = process.env.DATABASE_URL || 'mysql://username:password@localhost:3306/hrm_database';
const dbUrl = new URL(rawDbUrl);
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Truncate a Date to the start of its minute (zero out seconds + ms). */
function truncateToMinute(d: Date): number {
  const floored = new Date(d);
  floored.setSeconds(0, 0);
  return floored.getTime();
}

function sep() {
  console.log('─'.repeat(70));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚑  Attendance DB Emergency Cleanup');
  sep();
  console.log(`   Mode        : ${DRY_RUN ? '🟡 DRY RUN (no deletes)' : '🔴 LIVE (will delete rows)'}`);
  console.log(`   Go-live date: ${GO_LIVE_DATE.toISOString()}`);
  console.log(`   DB          : ${dbUrl.hostname}:${dbUrl.port || 3306}/${dbUrl.pathname.slice(1)}`);
  sep();

  // ── Phase 0: Count overview ──────────────────────────────────────────────
  const totalBefore = await prisma.attendanceLog.count();
  const manualBefore = await prisma.attendanceLog.count({ where: { deviceId: 'Manual Entry' } });
  console.log(`\n📦 Total attendance logs in DB    : ${totalBefore}`);
  console.log(`📋 Manual entries (protected)     : ${manualBefore}`);

  // ── Phase 1: Delete pre-go-live ghost records ────────────────────────────
  console.log(`\n🗑️  Phase 1 — Deleting device logs before ${GO_LIVE_DATE.toISOString()} ...`);

  const ghostCount = await prisma.attendanceLog.count({
    where: {
      timestamp: { lt: GO_LIVE_DATE },
      deviceId: { not: 'Manual Entry' }, // Never touch manual entries
    },
  });
  console.log(`   Found ${ghostCount} pre-go-live device log(s) to purge.`);

  if (!DRY_RUN && ghostCount > 0) {
    const result = await prisma.attendanceLog.deleteMany({
      where: {
        timestamp: { lt: GO_LIVE_DATE },
        deviceId: { not: 'Manual Entry' },
      },
    });
    console.log(`   ✅ Deleted ${result.count} ghost records.`);
  } else if (ghostCount > 0) {
    console.log(`   ⏭️  DRY RUN — skipped deletion.`);
  } else {
    console.log(`   ✅ None found — database is clean for Phase 1.`);
  }

  // ── Phase 2: Deduplicate by (employeeId, minute) ─────────────────────────
  console.log('\n🔍 Phase 2 — Loading remaining device logs for minute-dedup...');

  const allDeviceLogs = await prisma.attendanceLog.findMany({
    where: { deviceId: { not: 'Manual Entry' } },
    select: { id: true, employeeId: true, timestamp: true, createdAt: true, punchType: true },
    orderBy: { timestamp: 'asc' },
  });

  console.log(`   Loaded ${allDeviceLogs.length} device log(s) for analysis.`);

  // Group by (employeeId, minute-truncated timestamp)
  const groups = new Map<string, typeof allDeviceLogs>();
  for (const log of allDeviceLogs) {
    const minuteKey = `${log.employeeId}__${truncateToMinute(new Date(log.timestamp))}`;
    if (!groups.has(minuteKey)) groups.set(minuteKey, []);
    groups.get(minuteKey)!.push(log);
  }

  const idsToDelete: string[] = [];
  let groupsWithDuplicates = 0;

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;
    groupsWithDuplicates++;

    // Sort by createdAt ascending: keep the earliest insert
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const [keep, ...dupes] = group;

    console.log(
      `   ⚠️  Duplicate group (${group.length} rows) for emp ${keep.employeeId.slice(0, 8)}… ` +
      `at ~${new Date(truncateToMinute(new Date(keep.timestamp))).toISOString().slice(11, 16)} UTC` +
      ` → keeping ${keep.id.slice(0, 8)}… [${keep.punchType}], deleting ${dupes.length}.`
    );
    for (const d of dupes) idsToDelete.push(d.id);
  }

  if (idsToDelete.length === 0) {
    console.log('   ✅ No minute-level duplicates found — Phase 2 is clean.');
  } else {
    console.log(`\n   Found ${idsToDelete.length} duplicate log(s) across ${groupsWithDuplicates} minute-group(s).`);
    if (!DRY_RUN) {
      const BATCH = 500;
      let deleted = 0;
      for (let i = 0; i < idsToDelete.length; i += BATCH) {
        const batch = idsToDelete.slice(i, i + BATCH);
        const r = await prisma.attendanceLog.deleteMany({ where: { id: { in: batch } } });
        deleted += r.count;
        console.log(`   → Batch ${Math.floor(i / BATCH) + 1}: deleted ${r.count}`);
      }
      console.log(`   ✅ Deleted ${deleted} duplicate log(s).`);
    } else {
      console.log('   ⏭️  DRY RUN — skipped deletion.');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  sep();
  const totalAfter = await prisma.attendanceLog.count();
  const manualAfter = await prisma.attendanceLog.count({ where: { deviceId: 'Manual Entry' } });
  console.log('\n📊 Final Summary');
  console.log(`   Logs before  : ${totalBefore}`);
  console.log(`   Logs after   : ${totalAfter}`);
  console.log(`   Removed      : ${totalBefore - totalAfter}`);
  console.log(`   Manual entries (preserved) : ${manualAfter}`);
  if (manualBefore !== manualAfter) {
    console.error('🚨 WARNING: Manual entry count changed! This should NOT happen. Investigate immediately.');
  }
  sep();
  if (DRY_RUN) {
    console.log('\n🟡 DRY RUN complete — no rows were deleted. Re-run without DRY_RUN=true to apply.\n');
  } else {
    console.log('\n✅ Cleanup complete. Run `npx prisma db push` if schema changes are needed.\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
