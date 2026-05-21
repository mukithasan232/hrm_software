import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Seed Script: Default Superadmin & Admin accounts
 *
 * Supported roles: Admin | Superadmin | Stakeholder | HRM Manager | Employee
 *
 * Run with:
 *   npx ts-node --esm -e commonjs src/scripts/seedAdmins.ts
 *   — or via package.json script: npm run seed:admins
 */

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

async function seedAdmins() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🌱 Seeding Default Admin & Superadmin Users');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    for (const seedUser of SEED_USERS) {
      const hashedPassword = await bcrypt.hash(seedUser.password, 12);

      const user = await prisma.user.upsert({
        where: { email: seedUser.email },
        update: {
          name:        seedUser.name,
          password:    hashedPassword,
          role:        seedUser.role,
          department:  seedUser.department,
          designation: seedUser.designation,
          isActive:    seedUser.isActive,
        },
        create: {
          name:        seedUser.name,
          email:       seedUser.email,
          password:    hashedPassword,
          role:        seedUser.role,
          employeeId:  seedUser.employeeId,
          department:  seedUser.department,
          designation: seedUser.designation,
          baseSalary:  seedUser.baseSalary,
          isActive:    seedUser.isActive,
        },
      });

      console.log(`  ✅ [${user.role.padEnd(12)}]  ${user.email}  (ID: ${user.id})`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 Seed complete. Both accounts are ready.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (err: any) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.code === 'P2002') {
      console.error('   → Unique constraint violation. Check employeeId or email duplicates.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

seedAdmins();
