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
//   1. Imports prisma.ts which immediately starts probing all socket/TCP candidates.
//   2. Awaits dbReady — the probe resolves with the first working config.
//   3. Builds a reliable DATABASE_URL from the winning config and runs:
//        prisma db push  → creates/migrates all tables
//        seedAdmins.ts   → upserts default admin accounts
//   4. HTTP server starts only AFTER schema + seed are confirmed.
// No manual env vars or Hostinger panel changes are required.
async function bootstrapDatabase() {
  const { execSync } = require('child_process');

  // Trigger the connection probe (prisma.ts starts it at import time)
  const { dbReady } = require('./src/lib/prisma');
  console.log('[Bootstrap] 🔬 Waiting for DB connection probe...');
  await dbReady;

  // Read the winning config that the prober stored on globalThis
  const probed = global.prismaConfig || null;

  // ── Build a reliable DATABASE_URL for CLI commands ────────────────────────
  const rawUrl   = process.env.DATABASE_URL || '';
  let resolvedUrl = rawUrl;

  if (probed) {
    if (probed.socketPath) {
      // Socket winner: inject ?socket= so Prisma CLI uses it
      try {
        const u = new URL(rawUrl || 'mysql://localhost/hrm_database');
        u.hostname = u.hostname || 'localhost';
        u.searchParams.set('socket', probed.socketPath);
        resolvedUrl = u.toString();
        console.log(`[Bootstrap] 🔌 CLI will use Unix socket: ${probed.socketPath}`);
      } catch {
        resolvedUrl = rawUrl;
      }
    } else {
      // TCP winner: rebuild URL with the working host
      try {
        const u = new URL(rawUrl || 'mysql://localhost/hrm_database');
        u.hostname = probed.host || u.hostname;
        u.port     = String(probed.port || 3306);
        u.searchParams.delete('socket');
        resolvedUrl = u.toString();
        console.log(`[Bootstrap] 🔌 CLI will use TCP: ${probed.host}:${probed.port}`);
      } catch {
        resolvedUrl = rawUrl;
      }
    }
  } else {
    // No probe winner — apply IPv4 fix and hope for the best
    resolvedUrl = rawUrl.replace(
      /\/\/(.*?)@localhost(:\d+)?\//,
      (_, creds, port) => `//${creds}@127.0.0.1${port || ':3306'}/`
    );
    console.warn('[Bootstrap] ⚠️  No working DB config found by probe. Falling back to DATABASE_URL as-is.');
  }

  const env = {
    ...process.env,
    DATABASE_URL: resolvedUrl,
    ...(probed?.socketPath ? { DB_SOCKET_PATH: probed.socketPath } : {}),
  };

  // ── Sync schema ───────────────────────────────────────────────────────────
  try {
    console.log('🔧 [Bootstrap] Running prisma db push...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env });
    console.log('✅ [Bootstrap] Schema synced to live database.');
  } catch {
    console.error('⚠️  [Bootstrap] prisma db push failed — server will continue, but DB may be uninitialized.');
    console.error('   Run:  npx ts-node src/scripts/test-connection.ts  on the server terminal to diagnose.');
    return; // Skip seed if schema push failed
  }

  // ── Seed default admin accounts ───────────────────────────────────────────
  try {
    console.log('🌱 [Bootstrap] Running seedAdmins...');
    execSync(
      `npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' src/scripts/seedAdmins.ts`,
      { stdio: 'inherit', env }
    );
    console.log('✅ [Bootstrap] Seed complete.');
  } catch {
    console.error('⚠️  [Bootstrap] Seed failed — accounts may not exist yet. Check logs above.');
  }
}
// ─────────────────────────────────────────────────────────────────────────────


const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

// Run bootstrap THEN start HTTP server so DB is always ready before first request
bootstrapDatabase()
  .catch(err => console.error('[Bootstrap] Unexpected error:', err))
  .finally(() => {
    app.prepare().then(async () => {
      const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      });

      const io = new Server(httpServer, {
        cors: {
          origin: process.env.ALLOWED_ORIGIN || '*',
          methods: ['GET', 'POST'],
        },
      });

      try {
        const { connectDB }              = require('./src/config/db');
        const { initCronJobs }           = require('./src/jobs/cronJob');
        const { initRealtimeAttendance } = require('./src/services/realtimeService');

        // 1. Verify DB connection and run dirty-log cleanup
        await connectDB();

        // 2. Background cron jobs
        initCronJobs();

        // 3. Realtime biometric device sync (non-blocking)
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
  });

