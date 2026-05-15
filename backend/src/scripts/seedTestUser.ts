import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { connectDB } from '../config/db';

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Script: Seed Test User for Biometric Verification
 * Matches User ID "5" on the ZKTeco device.
 */
async function seedTestUser() {
  console.log('\n--- 🧪 Seeding Test User for Biometric Verification ---');
  
  try {
    await connectDB();

    const targetEmployeeId = "5";
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Prepare User Data
    const userData = {
      name: 'Tushar',
      email: 'tushar@example.com',
      password: hashedPassword,
      role: 'Employee' as const,
      employeeId: targetEmployeeId,
      baseSalary: 45000,
      department: 'Engineering',
      designation: 'Software Developer',
      isActive: true
    };

    // Upsert: Find by employeeId, update if exists, create if not
    const user = await prisma.user.upsert({
      where: { employeeId: targetEmployeeId },
      update: userData,
      create: userData
    });

    console.log('\n✅ Operation Successful!');
    console.log('--- 🔍 Final User Data in MongoDB ---');
    console.log(JSON.stringify(user, null, 2));
    console.log('\nThis user is now ready to match User ID: 5 from your K60 device.');

  } catch (err: any) {
    console.error('\n❌ Seeding Failed!');
    console.error('Reason:', err.message);
  } finally {
    console.log('--- Seed End ---');
    await prisma.$disconnect();
    process.exit(0);
  }
}

seedTestUser();

