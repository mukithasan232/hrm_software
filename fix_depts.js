const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { department: { not: null } }
  });

  for (const user of users) {
    if (user.department) {
      const dept = await prisma.department.findFirst({
        where: { name: user.department }
      });
      if (dept) {
        await prisma.user.update({
          where: { id: user.id },
          data: { departmentId: dept.id }
        });
        console.log(`Updated user ${user.name} to dept ${dept.name}`);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
