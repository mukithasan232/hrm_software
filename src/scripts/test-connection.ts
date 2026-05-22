/**
 * test-connection.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Exhaustive MariaDB/MySQL connection probe.
 * Push this to the server, run it, and it will tell you EXACTLY which
 * connection method works on Hostinger.
 *
 * Usage (on the live server terminal):
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
 *     src/scripts/test-connection.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as mariadb from 'mariadb';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rawUrl   = process.env.DATABASE_URL || '';
const dbUrl    = rawUrl ? new URL(rawUrl) : null;
const DB_USER  = dbUrl?.username || process.env.DB_USER     || 'tushar';
const DB_PASS  = dbUrl?.password || process.env.DB_PASSWORD || 'password123';
const DB_NAME  = dbUrl ? dbUrl.pathname.slice(1) : (process.env.DB_NAME || 'hrm_database');

// Common Unix socket paths on Linux hosting environments
const SOCKET_PATHS = [
  '/var/run/mysqld/mysqld.sock',     // Ubuntu/Debian default
  '/tmp/mysql.sock',                 // CentOS/older systems
  '/var/lib/mysql/mysql.sock',       // Some cPanel hosts
  '/run/mysqld/mysqld.sock',         // systemd-managed
  '/opt/alt/mysql80/var/lib/mysql/mysql.sock', // CloudLinux / LiteSpeed stacks
];

// TCP hosts to try
const TCP_HOSTS = [
  '127.0.0.1',
  'localhost',
  'mysql',         // Docker/container alias
  '::1',           // IPv6 loopback (explicitly)
];

// ─── Utility ─────────────────────────────────────────────────────────────────
async function probe(label: string, config: mariadb.PoolConfig): Promise<boolean> {
  let conn: mariadb.PoolConnection | null = null;
  try {
    const pool = mariadb.createPool({ ...config, connectTimeout: 4000, connectionLimit: 1 });
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT VERSION() as v');
    console.log(`  ✅ SUCCESS  [${label}]  →  MariaDB/MySQL ${rows[0].v}`);
    await conn.release();
    await pool.end();
    return true;
  } catch (err: any) {
    const msg = (err.message || '').replace(/\n/g, ' ').slice(0, 120);
    console.log(`  ❌ FAILED   [${label}]  →  ${msg}`);
    try { conn?.release(); } catch (_) {}
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runProbes() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  🔬 MariaDB Connection Diagnostic  —  hrm.fixanyphoto.com');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  DB User : ${DB_USER}`);
  console.log(`  DB Name : ${DB_NAME}`);
  console.log(`  Raw URL : ${rawUrl.replace(/:([^@]+)@/, ':****@') || '(not set)'}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  const working: string[] = [];

  // 1. TCP probes
  console.log('  ── TCP probes ──────────────────────────────────────────────');
  for (const host of TCP_HOSTS) {
    const label = `TCP  ${host}:3306`;
    const ok = await probe(label, { host, port: 3306, user: DB_USER, password: DB_PASS, database: DB_NAME });
    if (ok) working.push(`TCP → ${host}:3306`);
  }

  // 2. Unix socket probes
  console.log('\n  ── Unix socket probes ──────────────────────────────────────');
  for (const socketPath of SOCKET_PATHS) {
    const exists = fs.existsSync(socketPath);
    if (!exists) {
      console.log(`  ⏭  SKIP     [Socket ${socketPath}]  →  file not found`);
      continue;
    }
    const label = `SOCK ${socketPath}`;
    const ok = await probe(label, { socketPath, user: DB_USER, password: DB_PASS, database: DB_NAME });
    if (ok) working.push(`Socket → ${socketPath}`);
  }

  // 3. Summary
  console.log('\n══════════════════════════════════════════════════════════════');
  if (working.length === 0) {
    console.log('  ⛔  No working connection found.');
    console.log('  Possible causes:');
    console.log('    • MariaDB is not installed or not running on this server');
    console.log('    • Database or user does not exist');
    console.log('    • User has no access privileges');
    console.log('');
    console.log('  Run these in Hostinger terminal to diagnose:');
    console.log('    systemctl status mariadb');
    console.log(`    mysql -u ${DB_USER} -p${DB_PASS} -e "SHOW DATABASES;"`);
  } else {
    console.log(`  🎉  ${working.length} working connection(s) found:\n`);
    working.forEach((w, i) => console.log(`     ${i + 1}. ${w}`));
    console.log('');
    console.log('  ✏️  Recommended DATABASE_URL fix:');
    const first = working[0];
    if (first.startsWith('Socket')) {
      const sock = first.replace('Socket → ', '');
      console.log(`     DATABASE_URL="mysql://${DB_USER}:PASSWORD@localhost/${DB_NAME}?socket=${sock}"`);
      console.log('     — OR set DB_SOCKET_PATH in your env vars:');
      console.log(`     DB_SOCKET_PATH="${sock}"`);
    } else {
      const host = first.replace('TCP → ', '').split(':')[0];
      console.log(`     DATABASE_URL="mysql://${DB_USER}:PASSWORD@${host}:3306/${DB_NAME}"`);
    }
  }
  console.log('══════════════════════════════════════════════════════════════\n');
}

runProbes().catch(console.error);
