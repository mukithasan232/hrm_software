import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting cleanup of dummy/unmapped users...');

  try {
    // 1. Find the dummy users
    const dummyUsers = await prisma.user.findMany({
      where: {
        OR: [
          { employeeId: 'UNMAPPED_FALLBACK' },
          { name: 'Unmapped Device Users' }
        ]
      }
    });

    if (dummyUsers.length === 0) {
      console.log('✅ No dummy users found. Dashboard is already clean.');
      return;
    }

    const dummyUserIds = dummyUsers.map(u => u.id);

    console.log(`🗑️ Found ${dummyUsers.length} dummy user(s). Proceeding with deletion...`);

    // 2. Delete related records in a transaction
    await prisma.$transaction([
      prisma.attendanceLog.deleteMany({ where: { employeeId: { in: dummyUserIds } } }),
      prisma.leave.deleteMany({ where: { employeeId: { in: dummyUserIds } } }),
      prisma.notification.deleteMany({ where: { userId: { in: dummyUserIds } } }),
      prisma.payroll.deleteMany({ where: { employeeId: { in: dummyUserIds } } }),
      prisma.performance.deleteMany({ where: { employeeId: { in: dummyUserIds } } }),
      prisma.user.deleteMany({ where: { id: { in: dummyUserIds } } })
    ]);

    console.log(`✅ Successfully wiped ${dummyUsers.length} dummy user(s) and all associated records.`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
