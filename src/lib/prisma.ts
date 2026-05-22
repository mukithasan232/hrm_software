import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ─── Unix Socket Auto-Detection ───────────────────────────────────────────────
// Probe common Linux socket locations in priority order.
// This runs at module load time so every process finds the socket automatically
// without any manual env-var injection or Hostinger panel changes.
const KNOWN_SOCKET_PATHS = [
  '/var/run/mysqld/mysqld.sock',       // Ubuntu / Debian default
  '/run/mysqld/mysqld.sock',           // systemd-managed (same as above, alt path)
  '/var/lib/mysql/mysql.sock',         // cPanel / CentOS stacks
  '/tmp/mysql.sock',                   // Older systems & some cPanel setups
  '/opt/alt/mysql80/var/lib/mysql/mysql.sock', // CloudLinux / LiteSpeed VPS
];

function detectUnixSocket(): string {
  // 1. Explicit env override always wins (manual escape hatch)
  if (process.env.DB_SOCKET_PATH) return process.env.DB_SOCKET_PATH;

  // 2. ?socket= query param embedded in DATABASE_URL
  const rawUrl = process.env.DATABASE_URL || '';
  if (rawUrl) {
    try {
      const urlSocket = new URL(rawUrl).searchParams.get('socket') || '';
      if (urlSocket) return urlSocket;
    } catch { /* ignore parse errors */ }
  }

  // 3. Auto-probe known filesystem locations
  for (const p of KNOWN_SOCKET_PATHS) {
    if (fs.existsSync(p)) {
      console.log(`[Prisma] 🔍 Auto-detected Unix socket: ${p}`);
      return p;
    }
  }

  return ''; // No socket found → fall through to TCP
}

// ─── Pool Config Builder ──────────────────────────────────────────────────────
//
// Resolution priority (highest → lowest):
//  1. Auto-detected Unix socket  → fastest, bypasses all TCP firewall issues
//  2. TCP via DATABASE_URL host  → localhost forced to 127.0.0.1 (IPv4)
//  3. Hard fallback              → 127.0.0.1:3306 with env credentials
//
// Pool is deliberately kept small (3 connections) for a shared Hostinger VPS
// where MariaDB's max_connections is typically 50–100 and is shared by all
// running Node.js workers.
// ─────────────────────────────────────────────────────────────────────────────

function buildPoolConfig(): Record<string, any> {
  const rawUrl = process.env.DATABASE_URL || '';

  // Parse credentials from DATABASE_URL (with safe fallbacks)
  let user     = 'root';
  let password = '';
  let database = 'hrm_database';
  let host     = '127.0.0.1';
  let port     = 3306;

  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      user     = u.username || user;
      password = u.password || password;
      database = u.pathname.slice(1) || database;
      host     = u.hostname  || host;
      port     = Number(u.port) || port;
    } catch {
      console.error('[Prisma] ❌ Could not parse DATABASE_URL — using fallback credentials.');
    }
  }

  const resolvedSocket = detectUnixSocket();

  // Shared pool tuning (safe for any Hostinger plan)
  const poolTuning = {
    connectionLimit: 3,
    connectTimeout:  10_000,
    acquireTimeout:  10_000,
    idleTimeout:     60_000,
    resetAfterUse:   true,
  };

  // ── Path A: Unix socket ────────────────────────────────────────────────────
  if (resolvedSocket) {
    console.log(`[Prisma] 🔌 Connecting via Unix socket: ${resolvedSocket}`);
    return { socketPath: resolvedSocket, user, password, database, ...poolTuning };
  }

  // ── Path B: TCP connection ─────────────────────────────────────────────────
  // `localhost` on Linux often resolves to ::1 (IPv6) but MariaDB only listens
  // on 127.0.0.1 (IPv4). Force IPv4 to prevent silent connection drops.
  if (host === 'localhost') host = '127.0.0.1';

  console.log(`[Prisma] 🔌 Connecting via TCP: ${host}:${port} / db=${database}`);
  return { host, port, user, password, database, ...poolTuning };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// ⚠️  MUST be stored on globalThis in ALL environments (not just development).
// In Next.js production, module evaluation can run fresh per-request if the
// runtime garbage-collects module state. Without this guard, every request
// creates a new PrismaClient + new pool → "pool timeout active=0 idle=0".
// ─────────────────────────────────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const poolConfig = buildPoolConfig();
  const adapter    = new PrismaMariaDb(poolConfig);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma; // Always persist — see comment above
