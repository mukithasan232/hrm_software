import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import mariadb from 'mariadb';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// ─── Fix mariadb default import (no default export in some bundler contexts) ──
const mariadbPool = (mariadb as any).default ?? mariadb;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConfig: Record<string, any> | undefined;
};

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
// The prober tries each in sequence and picks the FIRST one that actually
// opens a real TCP or socket connection to MariaDB.
function buildCandidates(creds: ReturnType<typeof parseCredentials>): Array<Record<string, any>> {
  const { user, password, database, host, port } = creds;
  const base = { user, password, database };

  // ── Known Unix socket paths ────────────────────────────────────────────────
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

  // ── TCP host candidates ────────────────────────────────────────────────────
  // Includes: URL host, loopback, container network aliases, system hostname.
  const tcpHosts = Array.from(new Set([
    host,           // from DATABASE_URL (already normalised localhost→127.0.0.1)
    '127.0.0.1',
    'mysql',        // Docker / container network alias
    'mariadb',      // Alternative Docker alias
    os.hostname(),  // Container hostname may resolve to the DB bridge IP
  ])).filter(Boolean);

  const tcpCandidates = tcpHosts.map(h => ({
    ...base,
    host: h,
    port,
    _label: `tcp:${h}:${port}`,
  }));

  return [...socketCandidates, ...tcpCandidates];
}

// ─── Synchronous-style Connection Prober ─────────────────────────────────────
// Uses a short probe timeout (3 s) so we cycle through all candidates quickly
// at startup. The winner is cached on globalThis so subsequent hot-module
// reloads (Next.js dev) don't re-probe.
async function probeWorkingConfig(
  candidates: Array<Record<string, any>>
): Promise<Record<string, any> | null> {
  for (const candidate of candidates) {
    const { _label, ...config } = candidate;
    let pool: mariadb.Pool | null = null;
    let conn: mariadb.PoolConnection | null = null;
    try {
      pool = mariadbPool.createPool({ ...config, connectionLimit: 1, connectTimeout: 3_000 });
      conn = await pool.getConnection();
      await conn.query('SELECT 1');
      console.log(`[Prisma] ✅ Working connection: ${_label}`);
      return config; // ← this one works
    } catch {
      // silent — move to next candidate
    } finally {
      try { conn?.release(); } catch {}
      try { await pool?.end(); }  catch {}
    }
  }
  return null;
}

// ─── Pool Config Builder ──────────────────────────────────────────────────────
// If a working config was already probed (cached on globalThis), use it
// immediately. Otherwise fall back to the DATABASE_URL host so the server
// at least starts and shows useful error logs.
function buildPoolConfig(probed: Record<string, any> | null): Record<string, any> {
  const creds = parseCredentials();

  const base = probed ?? {
    host:     creds.host,
    port:     creds.port,
    user:     creds.user,
    password: creds.password,
    database: creds.database,
  };

  const label = probed
    ? (probed.socketPath ? `socket:${probed.socketPath}` : `tcp:${probed.host}:${probed.port}`)
    : `tcp:${creds.host}:${creds.port} (unprobed fallback)`;

  console.log(`[Prisma] 🔌 Building pool → ${label}`);

  return {
    ...base,
    connectionLimit: 3,      // safe for shared Hostinger VPS (max_connections ≈ 50–100)
    connectTimeout:  30_000, // 30 s — allows for slow container-restart cold starts
    acquireTimeout:  30_000, // 30 s — matches connectTimeout
    idleTimeout:     60_000, // 60 s — keep connections warm between requests
    resetAfterUse:   true,   // auto-reset session state after each query
  };
}

// ─── Bootstrap (async, runs once at module load) ──────────────────────────────
// We deliberately do NOT await this at module level (that would block Next.js
// module evaluation). Instead the probe result is stored on globalThis and
// used the first time createPrismaClient() is called, which happens lazily
// inside the first API request after startup — by that time the probe is done.
let probePromise: Promise<void> | null = null;

function runProbeOnce() {
  if (probePromise) return probePromise;
  probePromise = (async () => {
    if (globalForPrisma.prismaConfig) return; // already have a winner
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

// Start probing immediately so the result is ready before first request
if (typeof window === 'undefined') runProbeOnce();

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
