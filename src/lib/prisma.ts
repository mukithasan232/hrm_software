// ⚠️  DO NOT add top-level imports of 'mariadb', 'os', or 'fs' here.
// Next.js / Turbopack evaluates this file during the build phase when tracing
// API route dependencies. Any top-level import of a native Node module that
// tries to resolve a default export causes:
//   "TypeError: Cannot read properties of undefined (reading 'default')"
// All Node-native work is deferred inside runtime-only functions guarded by
//   typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build'

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma:       PrismaClient | undefined;
  prismaConfig: Record<string, any> | undefined;
};

// ─── Runtime-only: loaded lazily inside functions, never at module scope ──────
// Using require() inside functions means they are only evaluated when the
// function is actually called (at runtime on the server), not during build.
function getMariadb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('mariadb');
  return (m.default ?? m) as typeof import('mariadb');
}
function getFs()  { return require('fs')  as typeof import('fs');  }
function getOs()  { return require('os')  as typeof import('os');  }

// ─── Credentials ──────────────────────────────────────────────────────────────
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
      console.error('[Prisma] ❌ Could not parse DATABASE_URL — using fallback credentials.');
    }
  }

  if (host === 'localhost') host = '127.0.0.1';
  return { user, password, database, host, port };
}

// ─── Candidate Config Matrix ──────────────────────────────────────────────────
// Ordered from cheapest/most-likely to most expensive/least-likely.
// Called only at runtime (inside runProbeOnce), never during build.
function buildCandidates(creds: ReturnType<typeof parseCredentials>): Array<Record<string, any>> {
  const fs = getFs();
  const os = getOs();
  const { user, password, database, host, port } = creds;
  const base = { user, password, database };

  const SOCKET_PATHS = [
    '/var/run/mysqld/mysqld.sock',
    '/run/mysqld/mysqld.sock',
    '/var/lib/mysql/mysql.sock',
    '/tmp/mysql.sock',
    '/tmp/mysqld.sock',
    '/opt/alt/mysql80/var/lib/mysql/mysql.sock',
    '/opt/alt/mysql57/var/lib/mysql/mysql.sock',
  ];

  const socketCandidates = SOCKET_PATHS
    .filter(p => { try { return fs.existsSync(p); } catch { return false; } })
    .map(p => ({ ...base, socketPath: p, _label: `socket:${p}` }));

  const tcpHosts = Array.from(new Set([
    host,
    '127.0.0.1',
    'mysql',
    'mariadb',
    os.hostname(),
  ])).filter(Boolean);

  const tcpCandidates = tcpHosts.map(h => ({
    ...base, host: h, port, _label: `tcp:${h}:${port}`,
  }));

  return [...socketCandidates, ...tcpCandidates];
}

// ─── Connection Prober ────────────────────────────────────────────────────────
// Tests each candidate with a 3-second timeout using a raw mariadb pool.
// Called only at runtime (inside runProbeOnce), never during build.
async function probeWorkingConfig(
  candidates: Array<Record<string, any>>
): Promise<Record<string, any> | null> {
  const mariadb = getMariadb();

  for (const candidate of candidates) {
    const { _label, ...config } = candidate;
    let pool: import('mariadb').Pool | null = null;
    let conn: import('mariadb').PoolConnection | null = null;
    try {
      pool = mariadb.createPool({ ...config, connectionLimit: 1, connectTimeout: 3_000 });
      if (!pool) throw new Error('Pool not initialized');
      conn = await pool.getConnection();
      await conn.query('SELECT 1');
      console.log(`[Prisma] ✅ Working connection: ${_label}`);
      return config;
    } catch {
      // silent — move to next candidate
    } finally {
      try { conn?.release(); } catch {}
      try { await pool?.end();  } catch {}
    }
  }
  return null;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// Runs once at server startup. Guarded so it is a no-op during:
//   • Next.js build phase  (NEXT_PHASE === 'phase-production-build')
//   • Browser-side bundles (typeof window !== 'undefined')
// This means Turbopack never executes any mariadb/fs/os code while tracing.
let probePromise: Promise<void> | null = null;

function runProbeOnce(): Promise<void> {
  if (probePromise) return probePromise;

  // Build-time / browser guard — return a resolved promise immediately
  const isBuildPhase  = process.env.NEXT_PHASE === 'phase-production-build';
  const isBrowserSide = typeof window !== 'undefined';
  if (isBuildPhase || isBrowserSide) {
    return (probePromise = Promise.resolve());
  }

  probePromise = (async () => {
    if (globalForPrisma.prismaConfig) return; // already probed
    const creds      = parseCredentials();
    const candidates = buildCandidates(creds);
    console.log(`[Prisma] 🔬 Probing ${candidates.length} connection candidate(s)...`);
    const winner = await probeWorkingConfig(candidates);
    if (winner) {
      globalForPrisma.prismaConfig = winner;
    } else {
      console.error('[Prisma] ❌ No working DB connection found. Check DATABASE_URL and MariaDB status.');
      console.error('   Run:  npx ts-node src/scripts/test-connection.ts  on the server for details.');
    }
  })();

  return probePromise;
}

// Kick off the probe at import time — but only on the server at runtime.
// The build-phase guard above makes this a safe no-op during `next build`.
runProbeOnce();

// ─── Pool Config Builder ──────────────────────────────────────────────────────
function buildPoolConfig(probed: Record<string, any> | null): Record<string, any> {
  const creds = parseCredentials();
  const base  = probed ?? {
    host: creds.host, port: creds.port,
    user: creds.user, password: creds.password, database: creds.database,
  };
  const label = probed
    ? (probed.socketPath ? `socket:${probed.socketPath}` : `tcp:${probed.host}:${probed.port}`)
    : `tcp:${creds.host}:${creds.port} (unprobed fallback)`;

  console.log(`[Prisma] 🔌 Building pool → ${label}`);
  return {
    ...base,
    connectionLimit: 3,       // safe for shared Hostinger VPS (max_connections ≈ 50–100)
    connectTimeout:  30_000,  // 30 s — allows for slow container-restart cold starts
    acquireTimeout:  30_000,  // 30 s — matches connectTimeout
    idleTimeout:     60_000,  // 60 s — keep connections warm between requests
    resetAfterUse:   true,    // auto-reset session state after each query
  };
}

// ─── Prisma Client Factory ────────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const poolConfig = buildPoolConfig(globalForPrisma.prismaConfig ?? null);
  const adapter    = new PrismaMariaDb(poolConfig);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// Persisted on globalThis in ALL environments (not just development).
// Without this, Next.js production creates a new PrismaClient per-request
// → each request gets its own pool → "pool timeout active=0 idle=0".
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

// Export probe promise so server.js can await it before starting HTTP listener
export const dbReady: Promise<void> = probePromise ?? Promise.resolve();
