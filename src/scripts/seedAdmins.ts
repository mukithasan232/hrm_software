import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@fixanyphoto.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SuperAdmin@2026!';

const superAdminPermissions = {
  'employees.view': true,
  'employees.create': true,
  'employees.edit': true,
  'employees.delete': true,
  'attendance.view': true,
  'attendance.create': true,
  'attendance.edit': true,
  'attendance.delete': true,
  'attendance.export': true,
  'leaves.view': true,
  'leaves.approve': true,
  'leaves.edit': true,
  'leaves.delete': true,
  'payroll.view': true,
  'payroll.create': true,
  'payroll.edit': true,
  'payroll.export': true,
  'performance.view': true,
  'performance.create': true,
  'performance.edit': true,
  'performance.delete': true,
  'designations.view': true,
  'designations.create': true,
  'designations.edit': true,
  'designations.delete': true,
  'settings.view': true,
  'settings.edit': true,
};

async function seedAdmins() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🌱 Seeding Super Admin & Default User');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Create the "Super Admin" Designation
    const superAdminDesignation = await prisma.designation.upsert({
      where: { name: 'Super Admin' },
      update: { permissions: superAdminPermissions },
      create: {
        name: 'Super Admin',
        description: 'System Administrator with full access to all modules',
        permissions: superAdminPermissions,
      },
    });

    console.log(`  ✅ [Designation]  Super Admin  (ID: ${superAdminDesignation.id})`);

    // 2. Create ONE default user
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const adminUser = await prisma.user.upsert({
      where: { employeeId: 'ADM-001' },
      update: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        designationId: superAdminDesignation.id,
        isActive: true,
        documents: {},
      },
      create: {
        email: ADMIN_EMAIL,
        employeeId: 'ADM-001',
        name: 'System Admin',
        password: hashedPassword,
        designationId: superAdminDesignation.id,
        department: 'Management',
        baseSalary: 0,
        isActive: true,
        documents: {},
      },
    });

    console.log(`  ✅ [User]         ${adminUser.email}  (ID: ${adminUser.id})`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 Seed complete.                          ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (err: any) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmins();
