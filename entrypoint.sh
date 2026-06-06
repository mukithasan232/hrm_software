#!/bin/sh

# ─── Entrypoint for Docker / Coolify Production Container ─────────────────────
# All steps are non-fatal: if DB push or seed fails, the server still starts.
# This prevents a crash-loop when the DB is temporarily unreachable on first boot.

# 1. Sync database schema
echo "🚀 [1/3] Running Prisma DB Push..."
if ! ./node_modules/.bin/prisma db push --accept-data-loss; then
  echo "⚠️  Prisma db push failed. This is non-fatal — server will still start."
  echo "    Check DATABASE_URL and DB connectivity in Coolify environment variables."
fi

# 2. Seed default admin account
echo "🌱 [2/3] Running Admin Seed..."
if ! ./node_modules/.bin/ts-node \
    --transpile-only \
    --compiler-options '{"module":"CommonJS","moduleResolution":"node","esModuleInterop":true}' \
    src/scripts/seedAdmins.ts; then
  echo "⚠️  Seed failed. This is non-fatal — server will still start."
  echo "    Admin account may need to be seeded manually if the DB was just created."
fi

# 3. Start the production server using PM2
echo "🔥 [3/3] Starting PM2 with Next.js & ZKTeco Worker..."
exec pm2-runtime ecosystem.config.js