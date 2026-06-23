import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update Designation: "Employee"
  const empDesig = await prisma.designation.findFirst({
    where: { name: 'Employee' }
  });

  if (empDesig) {
    const perms = empDesig.permissions as any || {};
    if (!perms.Tasks) {
      perms.Tasks = {
        Access: 'Enabled',
        Create: 'Own',
        Read: 'Own',
        Edit: 'Own',
        Delete: 'Own'
      };
      await prisma.designation.update({
        where: { id: empDesig.id },
        data: { permissions: perms }
      });
      console.log('Successfully updated Employee Designation permissions for Tasks.');
    } else {
      console.log('Employee designation already has Tasks permissions.');
    }
  } else {
    console.log('Employee designation not found.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
