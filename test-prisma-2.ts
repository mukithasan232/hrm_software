import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

const defaultUrl = 'mysql://tushar:password123@localhost:3306/hrm_database';
const currentDbUrl = process.env.DATABASE_URL || defaultUrl;

const dbUrl = new URL(currentDbUrl);
console.log("DB URL from env:", process.env.DATABASE_URL || "Using local fallback");

const poolConfig: mysql.PoolOptions = {
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// সরাসরি mysql2 এর প্রমিস পুল ক্রিয়েট করুন
const pool = mysql.createPool(poolConfig);

// ✅ Prisma v7 uses top-level `datasourceUrl` — `datasources` was removed
const prisma = new PrismaClient({
  datasourceUrl: currentDbUrl,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
} as any);

async function main() {
  console.log("🔄 Querying MariaDB via Prisma...");
  const users = await prisma.user.findMany();
  console.log(`✅ Success! Total Users found in MariaDB: ${users.length}`);
}

main()
  .catch((error) => {
    console.error("❌ Database query failed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log("🔒 Database connection closed cleanly.");
  });