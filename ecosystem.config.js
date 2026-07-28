module.exports = {
  apps: [
    {
      name: 'next-web',
      script: 'server.cjs',          // ✅ Uses server.cjs so initCronJobs() + initRealtimeAttendance() run
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      }
    },
    {
      name: 'zk-worker',
      script: 'dist/workers/zk-sync-worker.js',
      instances: 1, // Must be 1 to prevent multiple UDP port bindings
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }
    }
  ]
};
