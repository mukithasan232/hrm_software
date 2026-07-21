import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.attendanceLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: { id: true, timestamp: true, checkOut: true, punchType: true, isMissingOut: true, deviceId: true }
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
