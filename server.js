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
// Runs prisma db push + seed every time the server starts.
// Idempotent — safe to re-run. Ensures live DB is always in sync after deploy.
// Uses execSync so HTTP server only starts AFTER schema is confirmed ready.
(function bootstrapDatabase() {
  const { execSync } = require('child_process');

  // Fix IPv6: replace `localhost` with `127.0.0.1` in DATABASE_URL for CLI commands
  const rawUrl = process.env.DATABASE_URL || '';
  const fixedUrl = rawUrl.replace(
    /\/\/(.*?)@localhost(:\d+)?\//,
    (_, creds, port) => `//${creds}@127.0.0.1${port || ':3306'}/`
  );

  // Pass DB_SOCKET_PATH through to CLI if set (for Hostinger Unix socket mode)
  const env = {
    ...process.env,
    DATABASE_URL: fixedUrl,
    ...(process.env.DB_SOCKET_PATH ? { DB_SOCKET_PATH: process.env.DB_SOCKET_PATH } : {}),
  };

  try {
    console.log('🔧 [Bootstrap] Running prisma db push...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env });
    console.log('✅ [Bootstrap] Schema synced to live database.');
  } catch (e) {
    console.error('⚠️  [Bootstrap] prisma db push failed — server will continue, but DB may be uninitialized.');
    console.error('   → Run: npx ts-node src/scripts/test-connection.ts  to diagnose the connection.');
    return; // Skip seed if schema push failed
  }

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
