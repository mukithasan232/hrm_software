const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
try {
  const adapter = new PrismaMariaDb('mysql://root:@127.0.0.1:3306/hrm_database?connectTimeout=30000');
  console.log("PrismaMariaDb created successfully");
} catch(e) {
  console.error("Crash PrismaMariaDb:", e);
}
