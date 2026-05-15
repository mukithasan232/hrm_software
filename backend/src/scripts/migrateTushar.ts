import dotenv from 'dotenv';
import path from 'path';
// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../config/db';
import { User } from '../models/User';

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
    console.log('✅ Connected to MongoDB.');

    // 1. Find User
    const user = await User.findOne({ name: new RegExp(TARGET_NAME, 'i') });
    
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
      user.employeeId = TARGET_ID;
      await user.save();
      console.log(`🚀 SUCCESS: Updated ID from "${oldId}" to "${TARGET_ID}"`);
    }

    // 3. Log final state for verification
    const verifiedUser = await User.findById(user._id);
    console.log('\n--- 🔍 Final Database Verification ---');
    console.log(JSON.stringify(verifiedUser, null, 2));
    
  } catch (err: any) {
    console.error('\n❌ Migration Failed!');
    console.error('Reason:', err.message);
  } finally {
    console.log('\n--- Migration End ---');
    process.exit(0);
  }
}

migrateUser();
