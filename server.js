// Build Guard — exit immediately during Next.js static build phase
if (process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('--build')) {
  console.log('🚀 [Build Guard] Next.js build phase detected. Skipping monolithic server execution.');
  process.exit(0);
}

// Load environment variables immediately
require('dotenv').config();

// Programmatically register ts-node so Node can run TypeScript backend files directly
require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowJs: true,
    skipLibCheck: true,
  },
});

// ─── Auto-Bootstrap DB on startup ────────────────────────────────────────────
// Zero-configuration deployment pipeline:
//   1. Auto-probes common Unix socket locations on the server filesystem.
//   2. If a socket is found it rewrites DATABASE_URL to use it, bypassing
//      any TCP firewall that blocks 127.0.0.1:3306 on Hostinger containers.
//   3. Falls back to TCP with localhost→127.0.0.1 (IPv4) fix.
// No manual env vars or Hostinger panel changes are required.
(function bootstrapDatabase() {
  const { execSync } = require('child_process');
  const fs = require('fs');

  // ── Step 1: Resolve the best available connection method ─────────────────
  const KNOWN_SOCKET_PATHS = [
    '/var/run/mysqld/mysqld.sock',
    '/run/mysqld/mysqld.sock',
    '/var/lib/mysql/mysql.sock',
    '/tmp/mysql.sock',
    '/opt/alt/mysql80/var/lib/mysql/mysql.sock',
  ];

  function detectSocket() {
    if (process.env.DB_SOCKET_PATH) return process.env.DB_SOCKET_PATH;
    for (const p of KNOWN_SOCKET_PATHS) {
      if (fs.existsSync(p)) {
        console.log(`[Bootstrap] 🔍 Auto-detected Unix socket: ${p}`);
        return p;
      }
    }
    return '';
  }

  const rawUrl    = process.env.DATABASE_URL || '';
  const socket    = detectSocket();

  let resolvedUrl = rawUrl;

  if (socket) {
    // Inject ?socket= into the URL so Prisma CLI picks it up automatically
    // e.g. mysql://user:pass@localhost/db  →  mysql://user:pass@localhost/db?socket=/var/run/mysqld/mysqld.sock
    try {
      const u = new URL(rawUrl);
      u.searchParams.set('socket', socket);
      // Prisma CLI also needs host set to localhost for the URL to be valid
      if (!u.hostname) u.hostname = 'localhost';
      resolvedUrl = u.toString();
      console.log(`[Bootstrap] 🔌 Using Unix socket for CLI: ${socket}`);
    } catch {
      resolvedUrl = rawUrl; // URL parse failed — pass as-is
    }
  } else {
    // TCP fallback: force localhost → 127.0.0.1 to avoid IPv6 resolution
    resolvedUrl = rawUrl.replace(
      /\/\/(.*?)@localhost(:\d+)?\//,
      (_, creds, port) => `//${creds}@127.0.0.1${port || ':3306'}/`
    );
    console.log('[Bootstrap] 🔌 Using TCP connection for CLI.');
  }

  const env = {
    ...process.env,
    DATABASE_URL: resolvedUrl,
    // Keep DB_SOCKET_PATH so the prisma.ts runtime layer also picks it up
    ...(socket ? { DB_SOCKET_PATH: socket } : {}),
  };

  // ── Step 2: Sync schema ───────────────────────────────────────────────────
  try {
    console.log('🔧 [Bootstrap] Running prisma db push...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env });
    console.log('✅ [Bootstrap] Schema synced to live database.');
  } catch (e) {
    console.error('⚠️  [Bootstrap] prisma db push failed — server will continue, but DB may be uninitialized.');
    console.error('   Tip: run  npx ts-node src/scripts/test-connection.ts  on the server terminal to diagnose.');
    return; // Skip seed if schema push failed
  }

  // ── Step 3: Seed default admin accounts ──────────────────────────────────
  try {
    console.log('🌱 [Bootstrap] Running seedAdmins...');
    execSync(
      `npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' src/scripts/seedAdmins.ts`,
      { stdio: 'inherit', env }
    );
    console.log('✅ [Bootstrap] Seed complete.');
  } catch (e) {
    console.error('⚠️  [Bootstrap] Seed failed — accounts may not exist yet. Check logs above.');
  }
})();
// ─────────────────────────────────────────────────────────────────────────────


const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  try {
    const { connectDB } = require('./src/config/db');
    const { initCronJobs } = require('./src/jobs/cronJob');
    const { initRealtimeAttendance } = require('./src/services/realtimeService');

    // 1. Establish database connection and run dirty logs cleanup
    await connectDB();

    // 2. Initialize Background Cron Jobs (always enabled — has its own error handling)
    initCronJobs();

    // 3. Initialize Realtime Biometric Device Sync (non-blocking — will retry on failure)
    initRealtimeAttendance(io).catch(err => {
      console.error('[Main] Realtime biometric listener init failed:', err.message);
    });
  } catch (err) {
    console.error('[Server Startup] Failed to load backend modules:', err);
    // Do NOT exit — let Hostinger keep the process alive for HTTP traffic
  }

  httpServer.listen(port, () => {
    console.log(`🚀 Monolithic Server running on http://localhost:${port}`);
  });
});
