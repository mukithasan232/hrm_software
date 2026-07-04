const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log("Fixing User...");
  await prisma.$executeRaw`UPDATE User SET documents = '[]' WHERE documents = ''`;
  await prisma.$executeRaw`UPDATE User SET permissions = '{}' WHERE permissions = ''`;
  await prisma.$executeRaw`UPDATE User SET leaveConfig = '{}' WHERE leaveConfig = ''`;
  
  console.log("Fixing Designation...");
  await prisma.$executeRaw`UPDATE Designation SET permissions = '{}' WHERE permissions = ''`;
  await prisma.$executeRaw`UPDATE Designation SET leaveConfig = '{}' WHERE leaveConfig = ''`;
  await prisma.$executeRaw`UPDATE Designation SET weekendDays = '[]' WHERE weekendDays = ''`;
  
  console.log("Fixing Role...");
  await prisma.$executeRaw`UPDATE Role SET permissions = '{}' WHERE permissions = ''`;
  await prisma.$executeRaw`UPDATE Role SET weekendDays = '[]' WHERE weekendDays = ''`;
  
  console.log("Fixing UserPermission...");
  await prisma.$executeRaw`UPDATE UserPermission SET matrix = '{}' WHERE matrix = ''`;
  
  console.log("Done.");
}

fix().catch(console.error).finally(() => prisma.$disconnect());
