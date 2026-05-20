import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';
import { connectDB } from '../config/db';

// Load .env from backend root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Migration Script: Update Employee ID for Biometric Sync
 * Use this to match DB users with their Device IDs.
 */
async function migrateUser() {
  const TARGET_NAME = "Tushar";
  const TARGET_ID = "5";

  console.log(`\n--- 🛠️  DB Migration: Matching "${TARGET_NAME}" to Device ID ${TARGET_ID} ---`);
  
  try {
    await connectDB();

    // 1. Find User
    const user = await prisma.user.findFirst({
      where: {
        name: { contains: TARGET_NAME }
      }
    });
    
    if (!user) {
      console.error(`❌ User "${TARGET_NAME}" not found in database.`);
      return;
    }

    console.log(`📍 Found User: ${user.name} | Current Email: ${user.email} | Current ID: ${user.employeeId}`);

    // 2. Update if different
    if (user.employeeId === TARGET_ID) {
      console.log(`ℹ️  User already has Employee ID "${TARGET_ID}". No change needed.`);
    } else {
      const oldId = user.employeeId;
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: TARGET_ID }
      });
      console.log(`🚀 SUCCESS: Updated ID from "${oldId}" to "${TARGET_ID}"`);
    }

    // 3. Log final state for verification
    const verifiedUser = await prisma.user.findUnique({ where: { id: user.id } });
    console.log('\n--- 🔍 Final Database Verification ---');
    console.log(JSON.stringify(verifiedUser, null, 2));
    
  } catch (err: any) {
    console.error('\n❌ Migration Failed!');
    console.error('Reason:', err.message);
  } finally {
    console.log('\n--- Migration End ---');
    await prisma.$disconnect();
    process.exit(0);
  }
}

migrateUser();

