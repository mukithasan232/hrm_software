import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const dbUrl = new URL(process.env.DATABASE_URL || 'mysql://username:password@localhost:3306/hrm_database');
const poolConfig = {
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  connectionLimit: 10,
};

const adapter = new PrismaMariaDb(poolConfig);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to database successfully.');

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
    console.error('   ⚠️  Server will continue running. DB-dependent routes may fail until connection is restored.');
  }
};
