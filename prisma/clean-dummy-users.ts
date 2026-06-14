import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting cleanup of auto-generated dummy users...');

  const dummyUsers = await prisma.user.findMany({
    where: {
      OR: [
        { name: { startsWith: 'User ' } },
        { employeeId: 'UNMAPPED_FALLBACK' },
        { email: { contains: 'fallback' } },
        { email: { contains: '@unmapped.local' } }
      ],
      NOT: {
        OR: [
          { name: { contains: 'Admin' } },
          { name: { contains: 'Super' } }
        ]
      }
    },
    include: {
      attendanceLogs: true
    }
  });

  if (dummyUsers.length === 0) {
    console.log('✅ No dummy users found. Directory is clean!');
    return;
  }

  console.log(`🗑️ Found ${dummyUsers.length} dummy users to clean up.`);

  for (const user of dummyUsers) {
    console.log(`Processing dummy user: ${user.name} (ID: ${user.id}, ZK_UID: ${user.zktecoId})`);
    
    // Rescue their attendance logs into RawDeviceLog before deleting
    if (user.attendanceLogs.length > 0) {
      const rawLogs = user.attendanceLogs.map((log) => ({
        deviceUserId: user.zktecoId ? String(user.zktecoId) : user.employeeId,
        recordTime: log.timestamp,
        punchType: log.punchType,
        ip: log.deviceId
      }));

      await prisma.rawDeviceLog.createMany({
        data: rawLogs,
        skipDuplicates: true
      });
      console.log(`   -> Rescued ${rawLogs.length} logs into RawDeviceLog.`);
    }

    // Delete the dummy user (will cascade delete AttendanceLogs, but we saved them to RawDeviceLog!)
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log(`   -> Deleted user ${user.name}`);
  }

  console.log('🎉 Cleanup complete. The Employee Directory is now strictly Opt-In!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
