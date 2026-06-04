import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';          // ← MUST match authController.ts (bcryptjs)
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ─── Hardcoded credentials — NOT read from ENV ────────────────────────────────
// ENV variables on Coolify CANNOT corrupt these values.
const ADMIN_EMAIL    = 'ultraadmin@fixanyphoto.com';  // hardcoded — do NOT change
const ADMIN_PASSWORD = 'SuperAdmin@2026!';              // hardcoded — do NOT change
// ──────────────────────────────────────────────────────────────────────────────

const superAdminPermissions: Prisma.JsonObject = {
  'employees.view':    true, 'employees.create': true, 'employees.edit': true, 'employees.delete': true,
  'attendance.view':   true, 'attendance.create': true, 'attendance.edit': true, 'attendance.delete': true, 'attendance.export': true,
  'leaves.view':       true, 'leaves.approve': true, 'leaves.edit': true, 'leaves.delete': true,
  'payroll.view':      true, 'payroll.create': true, 'payroll.edit': true, 'payroll.export': true,
  'performance.view':  true, 'performance.create': true, 'performance.edit': true, 'performance.delete': true,
  'designations.view': true, 'designations.create': true, 'designations.edit': true, 'designations.delete': true,
  'settings.view':     true, 'settings.edit': true,
};

async function seedAdmins() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🌱 Bulletproof Seed — Super Admin Account');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // ── Step 1: Upsert the "Super Admin" designation ───────────────────────
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

    // ── Step 2: Generate a fresh bcryptjs hash — 10 rounds (matches authController) ──
    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    console.log(`  🔐 [Hash]         Generated fresh bcryptjs hash (10 rounds)`);
    console.log(`  📧 [Email]        ${ADMIN_EMAIL}`);
    // Log first 20 chars of hash so we can cross-check in Coolify logs
    console.log(`  🔑 [Hash prefix]  ${hashedPassword.substring(0, 20)}...`);

    const emptyDocuments: Prisma.JsonObject = {};

    // ── Step 3: DESTRUCTIVE — wipe any existing row, then create fresh ─────
    // This guarantees NO corrupt/stale hash can survive. No upsert, no merge.
    const deleted = await prisma.user.deleteMany({
      where: { email: ADMIN_EMAIL },
    });
    console.log(`  🗑️  [Delete]       Removed ${deleted.count} existing record(s) for ${ADMIN_EMAIL}`);

    const adminUser = await prisma.user.create({
      data: {
        email:         ADMIN_EMAIL,
        employeeId:    'ADM-ULTRA',
        name:          'Ultra Admin',
        password:      hashedPassword,      // fresh bcryptjs hash — guaranteed correct
        designationId: superAdminDesignation.id,
        department:    'Management',
        baseSalary:    0,
        isActive:      true,
        documents:     emptyDocuments,
        employeeType:  'IN_HOUSE',
        userType:      'Employee',
      },
    });

    console.log(`  ✅ [User]         Created: ${adminUser.email}  (DB ID: ${adminUser.id})`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 Seed complete. Login credentials:');
    console.log('  ┌────────────────────────────────────────────────────┐');
    console.log(`  │  Email:    ${ADMIN_EMAIL.padEnd(38)} │`);
    console.log(`  │  Password: ${ADMIN_PASSWORD.padEnd(38)} │`);
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
