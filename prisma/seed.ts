import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🌱 Seeding Default Admin & Super Admin     ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Create the "Super Admin" Designation with full JSON permissions
  // All permissions ON. (We can define a big object, or simpler, a special flag, but let's just create an empty object or a generic one if our UI supports it. Let's just define a few common ones as true to populate the matrix).
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
    'roles.view': true,
    'roles.create': true,
    'roles.edit': true,
    'roles.delete': true,
    'settings.view': true,
    'settings.edit': true,
  };

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

  // 2. Create default Admin user
  const adminEmail = 'admin@fixanyphoto.com';
  const adminPassword = await bcrypt.hash('Admin@2026!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPassword,
      designationId: superAdminDesignation.id,
      isActive: true,
    },
    create: {
      email: adminEmail,
      employeeId: 'ADM001',
      name: 'System Admin',
      password: adminPassword,
      designationId: superAdminDesignation.id,
      department: 'Administration',
      baseSalary: 0,
      isActive: true,
    },
  });

  console.log(`  ✅ [User]         ${adminUser.email}  (ID: ${adminUser.id})`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 Seed complete.                          ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
