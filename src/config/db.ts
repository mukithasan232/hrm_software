import { PrismaClient } from '@prisma/client';
// ─── Persistence Guard ────────────────────────────────────────────────────────
// Warn loudly at startup if DATABASE_URL is missing or looks like a local/temp
// path that would be wiped on container restart (e.g. SQLite, in-memory).
const rawDbUrl = process.env.DATABASE_URL || '';
if (!rawDbUrl) {
  console.error('🚨 [DB] CRITICAL: DATABASE_URL is not set! All data will be lost on restart.');
} else if (rawDbUrl.startsWith('file:') || rawDbUrl.includes(':memory:') || rawDbUrl.includes('sqlite')) {
  console.error('🚨 [DB] CRITICAL: DATABASE_URL appears to be a local SQLite/in-memory database.');
  console.error('    On Coolify/Docker, the container filesystem is ephemeral.');
  console.error('    ACTION REQUIRED: Configure a persistent MariaDB/MySQL/PostgreSQL volume');
  console.error('    and point DATABASE_URL to it. Example:');
  console.error('    DATABASE_URL="mysql://user:pass@mariadb-host:3306/hrm_database"');
}

const dbUrl = new URL(rawDbUrl || 'mysql://username:password@localhost:3306/hrm_database');

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to database successfully.');
    console.log(`   DB Host: ${dbUrl.hostname}:${dbUrl.port || 3306} / ${dbUrl.pathname.slice(1)}`);

    // ── Startup cleanup: remove records with empty-string employeeId ──────
    // These are invalid referential-integrity violations, NOT real attendance logs.
    // Manual entries (deviceId = 'Manual Entry') will NEVER match this filter.
    try {
      const cleanedLogs = await prisma.attendanceLog.deleteMany({
        where: { employeeId: '' }
      });
      if (cleanedLogs.count > 0) {
        console.log(`🧹 Cleaned up ${cleanedLogs.count} invalid attendance logs (empty employeeId).`);
      }

      const cleanedPayrolls = await prisma.payroll.deleteMany({
        where: { employeeId: '' }
      });
      if (cleanedPayrolls.count > 0) {
        console.log(`🧹 Cleaned up ${cleanedPayrolls.count} invalid payroll records (empty employeeId).`);
      }
    } catch (e: any) {
      console.warn('⚠️ [Cleanup] Error running startup cleanup:', e.message);
    }

    // ── Manual entry persistence verification ────────────────────────────
    // Confirms the AttendanceLog table is reachable and manual entries survive.
    try {
      const manualCount = await prisma.attendanceLog.count({
        where: { deviceId: 'Manual Entry' }
      });
      console.log(`📋 [DB] Manual attendance entries in DB: ${manualCount}`);
    } catch (e: any) {
      console.warn('⚠️ [DB] Could not count manual entries:', e.message);
    }

  } catch (error: any) {
    console.error(`❌ Prisma connection error: ${error.message}`);
    console.error('   ⚠️  Server will continue running. DB-dependent routes may fail until connection is restored.');
  }
};
