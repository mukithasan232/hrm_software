import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ─── Pool config builder ──────────────────────────────────────────────────────
//
// Resolution priority (highest → lowest):
//
//  1. DB_SOCKET_PATH env var   → Unix socket (bypasses TCP entirely)
//  2. DATABASE_URL ?socket=    → Unix socket embedded in URL query string
//  3. DATABASE_URL host        → TCP with localhost→127.0.0.1 fix
//  4. Hard fallback            → 127.0.0.1:3306 (never blocks startup)
//
// Hostinger LiteSpeed VPS note:
//  On some Hostinger plans the Node.js process cannot reach MariaDB via TCP
//  even on 127.0.0.1 (connection goes through an internal proxy). In that
//  case, set DB_SOCKET_PATH to the socket file path shown by running:
//    npx ts-node src/scripts/test-connection.ts
//  on the server terminal, then add it to Hostinger's environment variables.
// ─────────────────────────────────────────────────────────────────────────────

function buildPoolConfig(): Record<string, any> {
  const rawUrl     = process.env.DATABASE_URL || '';
  const socketPath = process.env.DB_SOCKET_PATH || ''; // override via env panel

  // Base credentials from URL
  let user     = 'root';
  let password = '';
  let database = 'hrm_database';
  let host     = '127.0.0.1';
  let port     = 3306;
  let urlSocket = '';

  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      user     = u.username || user;
      password = u.password || password;
      database = u.pathname.slice(1) || database;
      host     = u.hostname || host;
      port     = Number(u.port) || port;
      // Support ?socket= query param in DATABASE_URL
      urlSocket = u.searchParams.get('socket') || '';
    } catch (e) {
      console.error('❌ [Prisma] Could not parse DATABASE_URL — using fallback config.');
    }
  }

  const resolvedSocket = socketPath || urlSocket;

  // ── Unix socket path (highest priority) ──────────────────────────────────
  if (resolvedSocket) {
    console.log(`[Prisma] 🔌 Using Unix socket: ${resolvedSocket}`);
    return {
      socketPath: resolvedSocket,
      user,
      password,
      database,
      connectionLimit:    5,
      connectTimeout:     10000,
      acquireTimeout:     10000,
      idleTimeout:        30000,
    };
  }

  // ── TCP connection ────────────────────────────────────────────────────────
  // Fix: `localhost` on Linux often resolves to ::1 (IPv6), but MariaDB
  // listens only on 127.0.0.1 (IPv4). Force IPv4 explicitly.
  if (host === 'localhost') host = '127.0.0.1';

  console.log(`[Prisma] 🔌 Using TCP: ${host}:${port} / db=${database}`);
  return {
    host,
    port,
    user,
    password,
    database,
    connectionLimit:    10,
    connectTimeout:     10000,
    acquireTimeout:     10000,
    idleTimeout:        30000,
  };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
const getPrismaClient = () => {
  const poolConfig = buildPoolConfig();
  const adapter    = new PrismaMariaDb(poolConfig);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
