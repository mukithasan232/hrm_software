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
//   1. Requires prisma.ts which synchronously detects the best socket/TCP URL
//      and sets process.env.DATABASE_URL before anything else runs.
//   2. prisma db push uses that URL → tables created/synced.
//   3. seedAdmins.ts child process inherits the same DATABASE_URL → seed runs.
//   4. HTTP server starts only AFTER both steps complete successfully.
// No manual env vars or Hostinger panel changes required.
async function bootstrapDatabase() {
  const { execSync } = require('child_process');

  // Import prisma.ts — this synchronously calls buildRuntimeUrl() which probes
  // socket paths via fs.existsSync and sets process.env.DATABASE_URL to the
  // best available connection string (socket or TCP).
  // DATABASE_URL is already provided natively by Neon in .env
  console.log(`[Bootstrap] 🔌 DATABASE_URL resolved to: ${(process.env.DATABASE_URL || '').replace(/:([^@]+)@/, ':****@')}`);

  // All child processes inherit process.env, so they automatically use the
  // socket-aware DATABASE_URL set above — no extra env injection needed.
  const env = { ...process.env };

  // ── Step 1: Sync schema (sequential, blocking) ────────────────────────────
  try {
    console.log('🔧 [Bootstrap] Running prisma db push...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env });
    console.log('✅ [Bootstrap] Schema synced.');
  } catch {
    console.error('⚠️  [Bootstrap] prisma db push failed.');
    console.error('   Run: npx ts-node src/scripts/test-connection.ts on the server to diagnose.');
    return; // skip seed — DB is uninitialized
  }

  // ── Step 2: Seed admin accounts (sequential, blocking, isolated process) ──
  try {
    console.log('🌱 [Bootstrap] Running seedAdmins...');
    execSync(
      `npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' src/scripts/seedAdmins.ts`,
      { stdio: 'inherit', env }
    );
    console.log('✅ [Bootstrap] Seed complete. Default accounts ready.');
  } catch {
    console.error('⚠️  [Bootstrap] Seed failed — accounts may not exist yet.');
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

     httpServer.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Monolithic Server running on http://0.0.0.0:${port} (Network Enabled)`);
      });
    });
  });

