/* eslint-disable @typescript-eslint/no-var-requires */
// Build Guard — exit immediately during Next.js static build phase
if (process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('--build')) {
  console.log('🚀 [Build Guard] Next.js build phase detected. Skipping monolithic server execution.');
  process.exit(0);
}

// Load environment variables immediately
require('dotenv').config();

// Programmatically register ts-node so Node can run TypeScript backend files directly
require('ts-node').register({
  transpileOnly: true, // Skip type-checking for speed (types are checked in CI)
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

const dev  = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

const app    = next({ dev });
const handle = app.getRequestHandler();

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

        // 3. Register socket.io with the realtime service.
        //    ⚠️  This no longer connects to ZKTeco at startup.
        //    The device connection is established on-demand when an admin
        //    clicks the Sync button (POST /api/attendance/sync-users).
        initRealtimeAttendance(io);
      } catch (err) {
        console.error('[Server Startup] Failed to load backend modules:', err);
        // Do NOT exit — let the process stay alive for HTTP traffic
      }

      httpServer.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Monolithic Server running on http://0.0.0.0:${port} (Network Enabled)`);
      });
    }).catch((err) => {
      console.error('❌ [Fatal] app.prepare() failed. Cannot start server:', err);
      process.exit(1);
    });
