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
const port = process.env.PORT || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  try {
    const { connectDB } = require('./src/config/db');
    const { initCronJobs } = require('./src/jobs/cronJob');
    const { initRealtimeAttendance } = require('./src/services/realtimeService');

    // 1. Establish database connection and run dirty logs cleanup
    await connectDB();

    // 2. Initialize Background Cron Jobs
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CRON === 'true') {
      initCronJobs();
    }

    // 3. Initialize Realtime Biometric Device Sync
    initRealtimeAttendance(io).catch(err => {
      console.error('[Main] Realtime biometric listener init failed:', err.message);
    });
  } catch (err) {
    console.error('[Server Startup] Failed to load backend modules:', err);
  }

  httpServer.listen(port, () => {
    console.log(`🚀 Monolithic Server running on http://localhost:${port}`);
  });
});
