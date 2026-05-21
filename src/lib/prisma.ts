import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Safely parse the DATABASE_URL — a malformed URL would otherwise throw
// synchronously at module load time and crash the entire server before
// any request is handled.
let poolConfig: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
};

try {
  const rawUrl = process.env.DATABASE_URL || 'mysql://username:password@localhost:3306/hrm_database';
  const dbUrl = new URL(rawUrl);
  poolConfig = {
    host: dbUrl.hostname,
    port: Number(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    connectionLimit: 10,
  };
} catch (e) {
  console.error('❌ [Prisma] Invalid DATABASE_URL — falling back to localhost defaults:', e);
  poolConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'hrm_database',
    connectionLimit: 10,
  };
}

const getPrismaClient = () => {
  const adapter = new PrismaMariaDb(poolConfig);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

