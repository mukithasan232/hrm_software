#!/bin/sh

# ─── Entrypoint for Docker / Coolify Production Container ─────────────────────
# All steps are non-fatal: if DB push or seed fails, the server still starts.
# This prevents a crash-loop when the DB is temporarily unreachable on first boot.

# ─── Robust DB Waiter ──────────────────────────────────────────────────────────
# Parse DB host and port from DATABASE_URL
echo "⏳ Waiting for database connection..."
# Use shell parameter expansion for robust parsing: remove protocol, user/pass, and trailing path.
DB_CONN_STRING=${DATABASE_URL#*@}
DB_HOST=${DB_CONN_STRING%:*}
DB_PORT=${DB_CONN_STRING#*:}
DB_PORT=${DB_PORT%/*}

if [ -n "$DB_HOST" ]; then
  # Use nc to check if the port is open (max 60 seconds)
  MAX_RETRIES=30
  RETRY_COUNT=0
  until nc -z "$DB_HOST" "${DB_PORT:-3306}" || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    echo "   Database ($DB_HOST) not reachable yet. Retrying in 2 seconds..."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
  done
  
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "⚠️  Database waiter timed out. Proceeding anyway..."
  else
    echo "✅ Database is reachable!"
  fi
fi

# 1. Sync database schema using db push
echo "🚀 [1/3] Syncing Prisma schema..."
if ! npx prisma generate || ! npx prisma db push --accept-data-loss --skip-generate; then
  echo "⚠️  Prisma db push failed. This is non-fatal — server will still start."
  echo "    Check DATABASE_URL and DB connectivity."
fi

# 2. Seed default admin account
echo "🌱 [2/3] Running Admin Seed..."
if ! pnpm exec tsx src/scripts/seedAdmins.ts; then
  echo "⚠️  Seed failed. This is non-fatal — server will still start."
  echo "    Admin account may need to be seeded manually if the DB was just created."
fi

# 2.5. Sync biometric data on boot
echo "🔄 [Boot Sync] Syncing Biometric Data..."
if ! pnpm exec tsx src/scripts/sync-on-boot.ts; then
  echo "⚠️  Biometric sync failed. This is non-fatal — server will still start."
fi

# ─── Port Sanitization ────────────────────────────────────────────────────────
echo "🧹 Sanitizing port 3000 to prevent EADDRINUSE conflicts..."
fuser -k 3000/tcp || true

# 3. Start the production server using PM2
echo "🔥 [3/3] Starting PM2 with Next.js & ZKTeco Worker..."
exec pm2-runtime ecosystem.config.js