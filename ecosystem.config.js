module.exports = {
  apps: [
    {
      name: 'next-web',
      script: 'node server.cjs',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'zk-worker',
      script: 'node',
      args: 'dist/workers/zk-sync-worker.js',
      instances: 1, // Must be 1 to prevent multiple UDP port bindings
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '256M', // Restart worker if memory exceeds 256MB
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
