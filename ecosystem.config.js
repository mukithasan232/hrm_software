module.exports = {
  apps: [
    {
      name: 'next-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0' // <--- This is required for Docker external access
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
        NODE_ENV: 'production'
      }
    }
  ]
};
