const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.role.deleteMany({
    where: { name: 'HR' }
  });
  console.log('Deleted HR role from DB');
}
main().catch(console.error).finally(() => prisma.$disconnect());
