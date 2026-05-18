import { prisma } from '../lib/prisma';

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to MongoDB successfully.');

    // Heal any dirty legacy empty-string employeeId records in database collections
    try {
      console.log('🧹 Running database cleanup for dirty logs...');
      const cleanedLogs = await prisma.attendanceLog.deleteMany({
        where: {
          employeeId: ""
        }
      });
      if (cleanedLogs.count > 0) {
        console.log(`🧹 Cleaned up ${cleanedLogs.count} invalid attendance logs.`);
      }

      const cleanedPayrolls = await prisma.payroll.deleteMany({
        where: {
          employeeId: ""
        }
      });
      if (cleanedPayrolls.count > 0) {
        console.log(`🧹 Cleaned up ${cleanedPayrolls.count} invalid payroll records.`);
      }
    } catch (e: any) {
      console.warn('⚠️ [Cleanup] Error running dirty logs cleanup:', e.message);
    }

  } catch (error: any) {
    console.error(`❌ Prisma connection error: ${error.message}`);
    
    if (error.message?.includes('whitelist') || error.message?.includes('ECONNREFUSED')) {
      console.error('   👉 Add your current IP to MongoDB Atlas → Network Access → IP Allowlist.');
    }

    process.exit(1);
  }
};

