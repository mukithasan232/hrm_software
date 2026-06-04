#!/bin/sh

# 1. Database Push (Force Reset to clear corrupted JSON constraints)
echo "🚀 Running Prisma DB Push..."
npx prisma db push --accept-data-loss

# 2. Seed Admin
echo "🌱 Running Seed Admin..."
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' src/scripts/seedAdmins.ts

# 3. Start the Server
echo "🔥 Starting Next.js Monolithic Server..."
exec node server.cjs