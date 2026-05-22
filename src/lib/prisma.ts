// ⚠️  DO NOT add top-level imports of 'fs' or 'os' here.
// Turbopack evaluates this file during build. Native-module work is deferred
// to runtime-only functions below.

import { PrismaClient } from '@prisma/client';

// ─── NOTE: @prisma/adapter-mariadb is NOT used ────────────────────────────────
// schema.prisma has no `driverAdapters` preview feature and no datasource url,
// so Prisma's own native engine handles the MySQL connection perfectly.
// The adapter was introduced to support Unix sockets but caused pool hangs on
// Hostinger's restricted containers. The native engine supports socket URLs
// natively via `?socket=<path>` in DATABASE_URL.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma:       PrismaClient | undefined;
  prismaConfig: Record<string, any> | undefined;
};

// ─── Lazy runtime-only helpers ────────────────────────────────────────────────
function getFs() { return require('fs') as typeof import('fs'); }
function getOs() { return require('os') as typeof import('os'); }

// ─── Credentials from DATABASE_URL ───────────────────────────────────────────
function parseCredentials() {
  const rawUrl = process.env.DATABASE_URL || '';
  let user     = 'root';
  let password = '';
  let database = 'hrm_database';
  let host     = '127.0.0.1';
  let port     = 3306;

  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      user     = decodeURIComponent(u.username) || user;
      password = decodeURIComponent(u.password) || password;
      database = u.pathname.slice(1)             || database;
      host     = u.hostname                      || host;
      port     = Number(u.port)                  || port;
    } catch {
      console.error('[Prisma] ❌ Could not parse DATABASE_URL.');
    }
  }
  if (host === 'localhost') host = '127.0.0.1';
  return { user, password, database, host, port };
}

// ─── Build a working DATABASE_URL for Prisma's native engine ─────────────────
// Priority:
//  1. DB_SOCKET_PATH env var (manual override)
//  2. ?socket= already in DATABASE_URL
//  3. Auto-probe known socket filesystem paths
//  4. TCP with localhost→127.0.0.1 fix
//
// The native engine accepts:
//   mysql://user:pass@localhost/db?socket=/tmp/mysql.sock
// ─────────────────────────────────────────────────────────────────────────────

const SOCKET_PATHS = [
  '/var/run/mysqld/mysqld.sock',
  '/run/mysqld/mysqld.sock',
  '/var/lib/mysql/mysql.sock',
  '/tmp/mysql.sock',
  '/tmp/mysqld.sock',
  '/opt/alt/mysql80/var/lib/mysql/mysql.sock',
  '/opt/alt/mysql57/var/lib/mysql/mysql.sock',
];

function buildRuntimeUrl(): string {
  const rawUrl = process.env.DATABASE_URL || '';
  const { user, password, database, host, port } = parseCredentials();

  // 1. Explicit env override
  const envSocket = process.env.DB_SOCKET_PATH || '';
  if (envSocket) {
    console.log(`[Prisma] 🔌 Using socket from DB_SOCKET_PATH: ${envSocket}`);
    return buildSocketUrl(user, password, database, envSocket);
  }

  // 2. ?socket= already in DATABASE_URL
  try {
    const existingSocket = new URL(rawUrl).searchParams.get('socket') || '';
    if (existingSocket) {
      console.log(`[Prisma] 🔌 Using socket from DATABASE_URL param: ${existingSocket}`);
      return buildSocketUrl(user, password, database, existingSocket);
    }
  } catch { /* ignore */ }

  // 3. Auto-probe filesystem socket paths
  const fs = getFs();
  for (const p of SOCKET_PATHS) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[Prisma] 🔍 Auto-detected socket: ${p}`);
        return buildSocketUrl(user, password, database, p);
      }
    } catch { /* ignore */ }
  }

  // 4. TCP fallback — force localhost → 127.0.0.1 (IPv4)
  console.log(`[Prisma] 🔌 No socket found. Using TCP: ${host}:${port}`);
  const encodedPass = encodeURIComponent(password);
  const encodedUser = encodeURIComponent(user);
  return `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;
}

function buildSocketUrl(user: string, password: string, database: string, socketPath: string): string {
  // Prisma native engine socket URL format:
  // mysql://user:pass@localhost/db?socket=/path/to/mysql.sock
  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);
  return `mysql://${encodedUser}:${encodedPass}@localhost/${database}?socket=${encodeURIComponent(socketPath)}`;
}

// ─── Prisma Client Factory ────────────────────────────────────────────────────
// Sets process.env.DATABASE_URL to the resolved URL so Prisma's native engine
// picks it up. This is the standard pattern for runtime URL overrides.
function createPrismaClient(): PrismaClient {
  const isBuildPhase  = process.env.NEXT_PHASE === 'phase-production-build';
  const isBrowserSide = typeof window !== 'undefined';

  // Don't probe or override DATABASE_URL during build or in browser
  if (!isBuildPhase && !isBrowserSide) {
    const runtimeUrl = buildRuntimeUrl();
    process.env.DATABASE_URL = runtimeUrl;
    console.log('[Prisma] ✅ DATABASE_URL set for native engine runtime.');
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// Persisted on globalThis in ALL environments — prevents per-request
// re-initialization in Next.js production workers.
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

// ─── dbReady ─────────────────────────────────────────────────────────────────
// No async probe needed — buildRuntimeUrl() is synchronous (just fs.existsSync).
// Exported so server.js interface stays compatible.
export const dbReady: Promise<void> = Promise.resolve();
