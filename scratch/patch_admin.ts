import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@fixanyphoto.com' } });
  if (user) {
    await prisma.user.update({
      where: { email: 'admin@fixanyphoto.com' },
      data: { userType: 'SUPER_ADMIN' }
    });
    console.log('Updated userType for admin@fixanyphoto.com to SUPER_ADMIN');
  } else {
    console.log('User admin@fixanyphoto.com not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
