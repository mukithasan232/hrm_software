import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { prisma } from '../lib/prisma';

async function executeWithRetry(operation: () => Promise<any>, label: string, maxRetries = 10): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const isConflict = err.message.includes('conflict') || err.message.includes('deadlock') || err.message.includes('WriteConflict');
      if (isConflict && attempt < maxRetries) {
        console.warn(`⚠️ [${label}] Write conflict encountered (Attempt ${attempt}/${maxRetries}). Retrying in 1.5s...`);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
}

async function runCleanup() {
  console.log('--- Dev Database Cleanup Start ---');
  try {
    // 1. Wipe all attendance logs
    console.log('🧹 Clearing attendance logs...');
    const deletedLogs = await executeWithRetry(
      () => prisma.attendanceLog.deleteMany({}),
      'ClearAttendanceLogs'
    );
    console.log(`✅ Wiped ${deletedLogs?.count || 0} attendance log(s) for a fresh slate.`);

    // Wipe all payroll records
    console.log('🧹 Clearing payroll history...');
    const deletedPayrolls = await executeWithRetry(
      () => prisma.payroll.deleteMany({}),
      'ClearPayrolls'
    );
    console.log(`✅ Wiped ${deletedPayrolls?.count || 0} payroll record(s) for a fresh slate.`);

    // 2. Identify target test users
    console.log('🔍 Identifying target test employees (EMP*)...');
    const testUsers = await prisma.user.findMany({
      where: {
        customDesignation: { name: { not: 'Admin' } },
        employeeId: { startsWith: 'EMP' }
      }
    });

    const userIds = testUsers.map(u => u.id);
    const employeeIds = testUsers.map(u => u.employeeId);
    console.log(`👉 Found ${testUsers.length} test employees to clean up.`);

    if (userIds.length > 0) {
      console.log('🧹 Deleting child records for test employees (cascade delete)...');

      // Removed Delete Daily Attendance
      // Delete Leaves
      await executeWithRetry(
        () => prisma.leave.deleteMany({ where: { employeeId: { in: userIds } } }),
        'DeleteLeaves'
      );

      // Delete Notifications
      await executeWithRetry(
        () => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),
        'DeleteNotifications'
      );

      // Delete Payrolls
      await executeWithRetry(
        () => prisma.payroll.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        'DeletePayrolls'
      );

      // Delete Performance records
      await executeWithRetry(
        () => prisma.performance.deleteMany({ where: { employeeId: { in: userIds } } }),
        'DeletePerformances'
      );

      // 3. Delete the test users themselves
      console.log('🧹 Deleting test employee User accounts...');
      const deletedUsers = await executeWithRetry(
        () => prisma.user.deleteMany({
          where: {
            id: { in: userIds }
          }
        }),
        'DeleteUsers'
      );
      console.log(`✅ Deleted ${deletedUsers?.count || 0} legacy test employee(s).`);
    } else {
      console.log('ℹ️ No test employees matching (EMP*) were found in the database.');
    }

    console.log('🎉 Database is now 100% clean and ready for your real device synced employees!');
  } catch (error: any) {
    console.error('❌ Error during database cleanup:', error.message || error);
  } finally {
    await prisma.$disconnect();
    console.log('--- Dev Database Cleanup End ---');
    process.exit(0);
  }
}

runCleanup();
