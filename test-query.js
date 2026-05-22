const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb('mysql://root:@127.0.0.1:3306/hrm_database?connectTimeout=30000');
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const user = await prisma.user.findFirst();
    console.log("Query success");
  } catch(e) {
    console.error("Query failed:", e);
  }
}
main();
