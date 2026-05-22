// ⚠️  DO NOT add top-level imports of 'fs' or 'os' here.
// Turbopack evaluates this file during build. Native-module work is deferred
// to runtime-only functions guarded by NEXT_PHASE / window checks.

import { PrismaClient } from '@prisma/client';

// ─── NOTE: @prisma/adapter-mariadb is NOT used ────────────────────────────────
// schema.prisma has no `driverAdapters` preview feature, so Prisma's own
// native Rust engine handles all MySQL connectivity.
// The adapter was removed because its internal mariadb Node.js pool exhausts
// Hostinger container file-descriptor limits under concurrent initialization.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ─── Credentials parser ───────────────────────────────────────────────────────
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
      // Always use 127.0.0.1 — `localhost` can resolve to ::1 (IPv6) on Linux
      // which MariaDB typically doesn't listen on.
      host     = (u.hostname === 'localhost' ? '127.0.0.1' : u.hostname) || host;
      port     = Number(u.port)                  || port;
    } catch {
      console.error('[Prisma] ❌ Could not parse DATABASE_URL — using fallback credentials.');
    }
  }

  return { user, password, database, host, port };
}

// ─── Runtime DATABASE_URL builder ────────────────────────────────────────────
// Strategy: always use standard TCP (127.0.0.1:3306) with Prisma's native
// connection URL parameters. This avoids Unix socket file-descriptor exhaustion
// on Hostinger containers where multiple concurrent initializations (cron jobs,
// realtime service, Prisma runtime) all compete for the same FD slots.
//
// Prisma's native Rust engine handles TCP pooling correctly under concurrency
// where the Node.js mariadb driver + adapter previously stalled.
//
// URL parameters (Prisma native engine syntax):
//   connection_limit  — max pool size (keep low on shared VPS)
//   pool_timeout      — seconds to wait before "pool timeout" error
//   connect_timeout   — seconds for the TCP handshake
// ─────────────────────────────────────────────────────────────────────────────
function buildRuntimeUrl(): string {
  const { user, password, database, host, port } = parseCredentials();

  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);

  const url = [
    `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`,
    `connection_limit=2`,   // max 2 pooled connections — safe for shared VPS
    `pool_timeout=30`,      // wait up to 30 s for a free connection
    `connect_timeout=30`,   // TCP connect timeout in seconds
  ].join('?') .replace('?', '?').replace(/\?(.+)/, (_, q) => '?' + q.replace(/\?/g, '&'));

  // Simpler construction:
  return (
    `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}` +
    `?connection_limit=2&pool_timeout=30&connect_timeout=30`
  );
}

// ─── Prisma Client Factory ────────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const isBuildPhase  = process.env.NEXT_PHASE === 'phase-production-build';
  const isBrowserSide = typeof window !== 'undefined';

  if (!isBuildPhase && !isBrowserSide) {
    // Override DATABASE_URL at runtime so the native engine uses our tuned URL.
    // process.env is shared across the whole Node.js process including child
    // processes spawned by server.js (seed script, etc.).
    const runtimeUrl = buildRuntimeUrl();
    process.env.DATABASE_URL = runtimeUrl;
    console.log(
      `[Prisma] ✅ DATABASE_URL → ${runtimeUrl.replace(/:([^@]+)@/, ':****@')}`
    );
  }

  return new PrismaClient({
    log: (process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']) as any,
  });
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// Persisted on globalThis in ALL environments — prevents per-request
// re-initialization in Next.js production workers which would create a new
// pool on every API request → "pool timeout active=0 idle=0".
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

// Exported for server.js compatibility (no async probe needed with TCP)
export const dbReady: Promise<void> = Promise.resolve();
