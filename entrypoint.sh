#!/bin/sh
set -e

# 1. Database Push
echo "🚀 Running Prisma DB Push..."
if ! ./node_modules/.bin/prisma db push --accept-data-loss; then
  echo "⚠️  Prisma db push failed. Continuing anyway..."
fi

# 2. Seed Admin (non-fatal)
echo "🌱 Running Seed Admin..."
if ! ./node_modules/.bin/ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' src/scripts/seedAdmins.ts; then
  echo "⚠️  Seed failed. Server will still start."
fi

# 3. Start the Server
echo "🔥 Starting Next.js Monolithic Server..."
exec node server.cjs