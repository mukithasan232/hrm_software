import { wrapHandler } from '@/lib/adapter';
import { prisma } from '@/lib/prisma';

export const GET = wrapHandler(async (req: any, res: any) => {
  try {
    console.log('🧹 [CleanupDev] Starting database cleanup...');
    
    // 1. Wipe all attendance logs
    const deletedLogs = await prisma.attendanceLog.deleteMany({});
    console.log(`🧹 [CleanupDev] Wiped ${deletedLogs.count} attendance logs.`);

    // 2. Wipe all payroll history
    const deletedPayrolls = await prisma.payroll.deleteMany({});
    console.log(`🧹 [CleanupDev] Wiped ${deletedPayrolls.count} payroll records.`);

    // 3. Identify target test users
    const testUsers = await prisma.user.findMany({
      where: {
        role: { not: 'Admin' },
        employeeId: { startsWith: 'EMP' }
      }
    });

    const userIds = testUsers.map(u => u.id);
    const employeeIds = testUsers.map(u => u.employeeId);

    if (userIds.length > 0) {
      console.log(`🧹 [CleanupDev] Deleting child records for ${testUsers.length} test employees...`);
      await prisma.leave.deleteMany({ where: { employeeId: { in: userIds } } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.payroll.deleteMany({ where: { employeeId: { in: employeeIds } } });

      const deletedUsers = await prisma.user.deleteMany({
        where: {
          id: { in: userIds }
        }
      });
      console.log(`🧹 [CleanupDev] Wiped ${deletedUsers.count} test employees.`);
    }

    res.status(200).json({
      message: 'Database cleaned successfully',
      deletedLogs: deletedLogs.count,
      deletedUsers: testUsers.length
    });
  } catch (error: any) {
    console.error('❌ [CleanupDev] Error during DB cleanup:', error);
    res.status(500).json({ message: 'Cleanup failed', error: error.message });
  }
});
