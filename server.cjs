/* eslint-disable @typescript-eslint/no-var-requires */

// Build Guard — exit immediately during Next.js static build phase
if (process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('--build')) {
  console.log('[Build Guard] Next.js build phase detected. Skipping server execution.');
  process.exit(0);
}

// Load environment variables
require('dotenv').config();

// Register ts-node so Node can require() TypeScript backend files at runtime.
// transpileOnly=true skips type-checking (already handled in CI/build step).
require('ts-node').register({
  transpileOnly: true,
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
const { parse }        = require('url');
const next             = require('next');
const { Server }       = require('socket.io');

const dev  = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

const app    = next({ dev });
const handle = app.getRequestHandler();

app.prepare()
  .then(async () => {
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

      await connectDB();
      initCronJobs();
      initRealtimeAttendance(io);
    } catch (err) {
      console.error('[Server Startup] Failed to load backend modules:', err);
      // Non-fatal: HTTP server still starts and serves the Next.js app
    }

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please kill the process using it or change the PORT in .env.`);
        process.exit(1);
      } else {
        console.error('❌ HTTP Server Error:', err);
      }
    });

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${port}`);
    });
  })
  .catch((err) => {
    console.error('❌ [Fatal] app.prepare() failed:', err);
    process.exit(1);
  });
