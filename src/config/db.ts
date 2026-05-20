import { prisma } from '../lib/prisma';

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to MariaDB successfully.');

    // Heal any dirty legacy empty-string employeeId records
    try {
      console.log('🧹 Running database cleanup for dirty logs...');
      const cleanedLogs = await prisma.attendanceLog.deleteMany({
        where: { employeeId: "" }
      });
      if (cleanedLogs.count > 0) {
        console.log(`🧹 Cleaned up ${cleanedLogs.count} invalid attendance logs.`);
      }

      const cleanedPayrolls = await prisma.payroll.deleteMany({
        where: { employeeId: "" }
      });
      if (cleanedPayrolls.count > 0) {
        console.log(`🧹 Cleaned up ${cleanedPayrolls.count} invalid payroll records.`);
      }
    } catch (e: any) {
      console.warn('⚠️ [Cleanup] Error running dirty logs cleanup:', e.message);
    }

  } catch (error: any) {
    console.error(`❌ Prisma connection error: ${error.message}`);

    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
      console.error('   👉 Check DATABASE_URL and that MariaDB is accessible from this host.');
    }

    // Do NOT call process.exit(1) — let the server stay up so HTTP routes can
    // still respond. The DB connection will be retried on next request via Prisma.
    console.error('   ⚠️  Server will continue running. DB-dependent routes may fail until connection is restored.');
  }
};


