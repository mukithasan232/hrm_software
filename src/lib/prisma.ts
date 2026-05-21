import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrismaClient = () => {
  let poolConfig: any;
  try {
    const rawUrl = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/hrm_database';
    const dbUrl = new URL(rawUrl);
    poolConfig = {
      host: dbUrl.hostname,
      port: Number(dbUrl.port) || 3306,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1),
      connectionLimit: 10,
    };

    // Fix Node.js IPv6 localhost resolution bug which causes 10000ms timeouts on LiteSpeed
    if (poolConfig.host === 'localhost') {
      poolConfig.host = '127.0.0.1';
    }
  } catch (e) {
    console.error('❌ [Prisma] Invalid DATABASE_URL:', e);
    poolConfig = { host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'hrm_database', connectionLimit: 10 };
  }

  const adapter = new PrismaMariaDb(poolConfig);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

