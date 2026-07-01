import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';          // ← MUST match authController.ts (bcryptjs)
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@fixanyphoto.com';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

const superAdminPermissions: Prisma.JsonObject = {
  'employees.view':    true, 'employees.create': true, 'employees.edit': true, 'employees.delete': true,
  'attendance.view':   true, 'attendance.create': true, 'attendance.edit': true, 'attendance.delete': true, 'attendance.export': true,
  'leaves.view':       true, 'leaves.approve': true, 'leaves.edit': true, 'leaves.delete': true,
  'payroll.view':      true, 'payroll.create': true, 'payroll.edit': true, 'payroll.export': true,
  'performance.view':  true, 'performance.create': true, 'performance.edit': true, 'performance.delete': true,
  'designations.view': true, 'designations.create': true, 'designations.edit': true, 'designations.delete': true,
  'settings.view':     true, 'settings.edit': true,
};

const adminPermissions: Prisma.JsonObject = {
  'employees.view':    true, 'employees.create': true, 'employees.edit': true,
  'attendance.view':   true, 'attendance.create': true, 'attendance.edit': true, 'attendance.export': true,
  'leaves.view':       true, 'leaves.approve': true, 'leaves.edit': true,
  'payroll.view':      true, 'payroll.create': true, 'payroll.edit': true, 'payroll.export': true,
  'performance.view':  true, 'performance.create': true, 'performance.edit': true,
  'designations.view': true,
  'settings.view':     true,
};

async function seedAdmins() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🌱 Bulletproof Seed — Super Admin Account');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // ── Step 1: Upsert the Designations ──────────────────────────────────────────
    const superAdminDesignation = await prisma.designation.upsert({
      where:  { name: 'Super Admin' },
      update: { permissions: superAdminPermissions },
      create: {
        name:        'Super Admin',
        description: 'System Administrator with full access to all modules',
        permissions: superAdminPermissions,
      },
    });
    console.log(`  ✅ [Designation]  Super Admin  (ID: ${superAdminDesignation.id})`);

    const adminDesignation = await prisma.designation.upsert({
      where:  { name: 'Admin' },
      update: { permissions: adminPermissions },
      create: {
        name:        'Admin',
        description: 'Administrator with access to most modules',
        permissions: adminPermissions,
      },
    });
    console.log(`  ✅ [Designation]  Admin        (ID: ${adminDesignation.id})`);

    // ── Step 2: Generate fresh bcryptjs hashes ──────────────────────────────────
    const salt           = await bcrypt.genSalt(10);
    const adminHash      = await bcrypt.hash(ADMIN_PASS, salt);

    const emptyDocuments: Prisma.JsonObject = {};

    // ── Step 3: Upsert existing users to preserve foreign keys ───────────────────
    const adminUser = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        password:      adminHash,
        designationId: superAdminDesignation.id,
        userType:      'Super Admin',
      },
      create: {
        email:         ADMIN_EMAIL,
        employeeId:    'ADM-STD',
        name:          'Admin User',
        password:      adminHash,
        designationId: superAdminDesignation.id,
        department:    'Management',
        baseSalary:    0,
        isActive:      true,
        documents:     emptyDocuments,
        employeeType:  'IN_HOUSE',
        userType:      'Super Admin',
      },
    });
    console.log(`  ✅ [User]         Upserted: ${adminUser.email}  (DB ID: ${adminUser.id})`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 Seed complete. Login credentials:');
    console.log('  ┌────────────────────────────────────────────────────┐');
    console.log(`  │  Admin Email: ${ADMIN_EMAIL.padEnd(36)} │`);
    console.log(`  │  Admin Pass:  ${ADMIN_PASS.padEnd(36)} │`);
    console.log('  └────────────────────────────────────────────────────┘');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err: any) {
    console.error('\n❌ Seed failed:', err.message);
    console.error(err);
    // Don't process.exit(1) — the entrypoint.sh handles failure gracefully
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmins();
