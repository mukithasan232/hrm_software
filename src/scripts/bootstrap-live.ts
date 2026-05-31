/**
 * bootstrap-live.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs Prisma schema push + seeds Superadmin & Admin directly into the
 * LIVE production database using credentials from .env.live
 *
 * Usage (from project root):
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
 *     src/scripts/bootstrap-live.ts
 *
 * Prerequisites:
 *   1. Fill in .env.live with your live DB credentials
 *   2. The live DB host must allow remote connections on port 3306
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

// ── Load .env.live (NOT .env) ─────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.live');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('\n❌ Could not load .env.live:', result.error.message);
  console.error('   Create .env.live with your live DATABASE_URL and retry.\n');
  process.exit(1);
}

const liveUrl = process.env.DATABASE_URL;
if (!liveUrl || liveUrl.includes('LIVE_DB_USER')) {
  console.error('\n❌ DATABASE_URL in .env.live is still a placeholder.');
  console.error('   Fill in your real live DB credentials first.\n');
  process.exit(1);
}

// Mask password for display
const maskedUrl = liveUrl.replace(/:([^@]+)@/, ':****@');
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🚀 Live Database Bootstrap Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  📡 Target: ${maskedUrl}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ── Step 1: Prisma generate ───────────────────────────────────────────────────
console.log('  [1/3] 🔧 Generating Prisma client...');
try {
  execSync('pnpm prisma generate', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('  ✅ Prisma client generated.\n');
} catch (e) {
  console.error('  ❌ prisma generate failed. See output above.');
  process.exit(1);
}

// ── Step 2: Prisma db push ────────────────────────────────────────────────────
console.log('  [2/3] 📦 Pushing schema to live database...');
try {
  execSync('pnpm prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('  ✅ Schema pushed to live DB.\n');
} catch (e) {
  console.error('  ❌ prisma db push failed. Check DB credentials and remote access.');
  process.exit(1);
}

// ── Step 3: Seed admin accounts ───────────────────────────────────────────────
console.log('  [3/3] 🌱 Seeding admin accounts into live database...');

// Dynamically import PrismaClient AFTER env is set
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

function buildPrisma() {
  const rawUrl = process.env.DATABASE_URL!;
  const dbUrl = new URL(rawUrl);
  const poolConfig = {
    host: dbUrl.hostname,
    port: Number(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    connectionLimit: 5,
  };
  const adapter = new PrismaMariaDb(poolConfig);
  return new PrismaClient({ adapter });
}

const SEED_USERS = [
  {
    name:        'Super Admin',
    email:       'superadmin@hrm.test',
    password:    'SuperAdminPassword123',
    role:        'Superadmin',
    employeeId:  'SA-001',
    department:  'Management',
    designation: 'Super Administrator',
    baseSalary:  0,
    isActive:    true,
  },
  {
    name:        'Admin',
    email:       'admin@hrm.test',
    password:    'AdminPassword123',
    role:        'Admin',
    employeeId:  'ADM-001',
    department:  'Management',
    designation: 'System Administrator',
    baseSalary:  0,
    isActive:    true,
  },
];

async function seedLive() {
  const prisma = buildPrisma();
  try {
    for (const seedUser of SEED_USERS) {
      const hashedPassword = await bcrypt.hash(seedUser.password, 12);
      const user = await prisma.user.upsert({
        where: { email: seedUser.email },
        update: {
          name:        seedUser.name,
          password:    hashedPassword,
          department:  seedUser.department,
          isActive:    seedUser.isActive,
          documents:   {},
        },
        create: {
          name:        seedUser.name,
          email:       seedUser.email,
          password:    hashedPassword,
          department:  seedUser.department,
          employeeId:  seedUser.employeeId,
          baseSalary:  seedUser.baseSalary,
          isActive:    seedUser.isActive,
          documents:   {},
        },
      });
      console.log(`  ✅ [${user.role.padEnd(12)}]  ${user.email}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 Bootstrap complete! Live database is ready.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  Login credentials:');
    console.log('  ┌─────────────────────────────────────────────────┐');
    console.log('  │  superadmin@hrm.test  /  SuperAdminPassword123  │');
    console.log('  │  admin@hrm.test       /  AdminPassword123        │');
    console.log('  └─────────────────────────────────────────────────┘');
    console.log('');
    console.log('  ⚠️  Remember: .env (local) is unchanged.');
    console.log('     Your local dev environment is unaffected.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (err: any) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.code === 'P1001') {
      console.error('   → Cannot reach live DB. Check:');
      console.error('     1. DB host/port is correct in .env.live');
      console.error('     2. Live server allows remote connections on port 3306');
      console.error('     3. DB user has correct privileges');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedLive();
