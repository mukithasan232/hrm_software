const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const mukit = await prisma.user.findFirst({ where: { name: { contains: 'Mukit' } } });
  console.log(JSON.stringify(mukit.documents, null, 2));
}

run().finally(() => prisma.$disconnect());
