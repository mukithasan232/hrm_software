import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as mariadb from 'mariadb';

const dbUrl = new URL(process.env.DATABASE_URL || 'mysql://username:password@localhost:3306/hrm_database');
console.log("DB URL from env:", process.env.DATABASE_URL);
const poolConfig = {
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  connectionLimit: 10,
};
console.log("Pool config:", poolConfig);

const pool = mariadb.createPool(poolConfig);
const adapter = new PrismaMariaDb(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
