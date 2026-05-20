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
