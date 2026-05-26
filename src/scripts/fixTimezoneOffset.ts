/**
 * ─── Timezone Migration Script ────────────────────────────────────────────────
 *
 * PURPOSE:
 *   All AttendanceLog timestamps stored BEFORE the timezone fix was applied
 *   contain a +6-hour error. The ZKTeco device sent local Bangladesh time
 *   (UTC+6), but the server stored it as-is treating it as UTC — meaning every
 *   punch is recorded 6 hours LATER than it actually occurred.
 *
 *   This script subtracts 6 hours from every existing AttendanceLog.timestamp
 *   to produce the correct UTC equivalent.
 *
 * HOW IT WORKS:
 *   Uses a direct mysql2 connection (NOT the Prisma pool) so it can run
 *   safely even while the dev/prod server is online.
 *   The SQL used:
 *     UPDATE AttendanceLog
 *     SET timestamp = DATE_SUB(timestamp, INTERVAL 6 HOUR)
 *     WHERE timestamp <= NOW()
 *
 * SAFETY:
 *   - Runs a DRY RUN by default (pass --apply to actually write changes).
 *   - Prints a preview of the first 10 records before/after.
 *   - Uses a single direct connection — zero pool contention with the server.
 *   - Optional CUTOFF_DATE env var to limit scope to records before a date.
 *
 * USAGE:
 *   # Preview only (safe — no writes):
 *   npx tsx src/scripts/fixTimezoneOffset.ts
 *
 *   # Actually apply the fix:
 *   npx tsx src/scripts/fixTimezoneOffset.ts --apply
 *
 *   # Apply but only fix records created before a specific date:
 *   CUTOFF_DATE=2026-05-26T15:00:00Z npx tsx src/scripts/fixTimezoneOffset.ts --apply
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mysql from 'mysql2/promise';

// ─── Config ───────────────────────────────────────────────────────────────────
const APPLY_CHANGES = process.argv.includes('--apply');

/**
 * Upper boundary: only fix logs whose current (wrong) timestamp is BEFORE this
 * cutoff. Logs written AFTER the fix was deployed already have correct
 * timestamps and must NOT be touched.
 * Default: the moment this script runs (all records up to now).
 */
const CUTOFF_DATE = process.env.CUTOFF_DATE
  ? new Date(process.env.CUTOFF_DATE)
  : new Date();

// ─── Parse DATABASE_URL ───────────────────────────────────────────────────────
const dbUrl = new URL(process.env.DATABASE_URL || 'mysql://root:@localhost:3306/hrm_database');
const dbConfig = {
  host:     dbUrl.hostname,
  port:     Number(dbUrl.port) || 3306,
  user:     decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  // Ensure JS Date objects are returned as Date, not strings
  dateStrings: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fmtRow(r: { id: string; employeeId: string; timestamp: Date | string }): string {
  return `  id=${String(r.id).slice(0, 8)}…  empId=${String(r.employeeId).slice(0, 8)}…  ts=${fmtDate(r.timestamp as Date)}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AttendanceLog Timezone Fix — UTC+6 Offset Correction     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!APPLY_CHANGES) {
    console.log('🔍  DRY RUN mode — no changes will be written to the database.');
    console.log('    Re-run with --apply to commit the fix.\n');
  } else {
    console.log('⚠️   APPLY mode — timestamps WILL be permanently modified.\n');
  }

  const cutoffIso = CUTOFF_DATE.toISOString().slice(0, 19).replace('T', ' ');
  console.log(`📅  Cutoff date : ${fmtDate(CUTOFF_DATE)}`);
  console.log(`⏰  Offset      : −6 hours  (DATE_SUB timestamp INTERVAL 6 HOUR)\n`);

  // Open a single, independent connection — completely separate from the
  // Prisma pool so the running dev server is not affected.
  const conn = await mysql.createConnection(dbConfig);
  console.log('🔌  Direct mysql2 connection established (independent of server pool).\n');

  try {
    // 1. Count affected rows
    const [countRows] = await conn.execute<any[]>(
      'SELECT COUNT(*) AS cnt FROM `AttendanceLog` WHERE `timestamp` <= ?',
      [cutoffIso]
    );
    const total: number = countRows[0]?.cnt ?? 0;

    if (total === 0) {
      console.log('✅  No records found before the cutoff date. Nothing to fix.');
      return;
    }

    console.log(`📊  Records to fix : ${total}\n`);

    // 2. Preview first 10 rows (current wrong values)
    const [previewRows] = await conn.execute<any[]>(
      'SELECT `id`, `employeeId`, `timestamp` FROM `AttendanceLog` WHERE `timestamp` <= ? ORDER BY `timestamp` ASC LIMIT 10',
      [cutoffIso]
    );

    console.log('── Preview (first 10 records) ─────────────────────────────────');
    console.log('BEFORE (wrong — stored as UTC but are actually UTC+6 values):');
    previewRows.forEach((r: any) => console.log(fmtRow(r)));

    console.log('\nAFTER  (correct — subtract 6 hours to get real UTC):');
    previewRows.forEach((r: any) => {
      const corrected = new Date(new Date(r.timestamp).getTime() - 6 * 60 * 60 * 1000);
      console.log(fmtRow({ ...r, timestamp: corrected }));
    });
    console.log('───────────────────────────────────────────────────────────────\n');

    if (!APPLY_CHANGES) {
      console.log('▶  Re-run with --apply to commit these changes.\n');
      return;
    }

    // 3. Apply the fix with a single atomic UPDATE statement
    console.log('🚀  Applying fix…');
    const [result] = await conn.execute<any>(
      `UPDATE \`AttendanceLog\`
       SET \`timestamp\` = DATE_SUB(\`timestamp\`, INTERVAL 6 HOUR)
       WHERE \`timestamp\` <= ?`,
      [cutoffIso]
    );

    const affectedRows: number = result?.affectedRows ?? 0;
    console.log(`\n✅  Migration complete. ${affectedRows} record(s) updated.\n`);

    // 4. Verification sample
    const [verifyRows] = await conn.execute<any[]>(
      'SELECT `id`, `employeeId`, `timestamp` FROM `AttendanceLog` ORDER BY `timestamp` ASC LIMIT 5'
    );

    if (verifyRows.length > 0) {
      console.log('── Verification Sample (first 5 after fix) ────────────────────');
      verifyRows.forEach((r: any) => console.log(fmtRow(r)));
      console.log('───────────────────────────────────────────────────────────────\n');
    }

  } finally {
    await conn.end();
    console.log('🔌  Connection closed. Done.\n');
  }
}

main().catch(err => {
  console.error('\n❌  Migration failed:', err.message || err);
  process.exit(1);
});
