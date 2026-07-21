import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.attendanceLog.findMany({
    where: {
      timestamp: {
        gte: new Date('2026-07-20T00:00:00Z'), // assuming it happened recently
      }
    },
    orderBy: { timestamp: 'desc' },
    select: { id: true, timestamp: true, checkOut: true, punchType: true, isMissingOut: true, deviceId: true, employeeId: true }
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
