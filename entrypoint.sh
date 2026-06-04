#!/bin/sh

# 1. Database Push (Force Reset to clear corrupted JSON constraints)
echo "🚀 Running Prisma DB Push (Force Reset)..."
npx prisma db push --force-reset

# 2. Seed Admin
echo "🌱 Running Seed Admin..."
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' src/scripts/seedAdmins.ts

# 3. Start the Server
echo "🔥 Starting Next.js Monolithic Server..."
exec node server.js