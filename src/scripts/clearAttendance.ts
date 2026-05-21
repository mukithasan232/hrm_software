import { prisma } from '../lib/prisma';

async function main() {
  console.log('🧹 Clearing attendance logs...');
  const result = await prisma.attendanceLog.deleteMany({});
  console.log(`✅ Deleted ${result.count} logs.`);
}

main()
  .catch((e) => {
    console.error('❌ Error clearing logs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
