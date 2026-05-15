import dotenv from 'dotenv';
import path from 'path';
// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../config/db';
import { User } from '../models/User';

async function updateTushar() {
  console.log('--- Database Migration: Update Tushar Device ID ---');
  try {
    // 1. Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to MongoDB.');

    // 2. Search for Tushar (Case-insensitive)
    const user = await User.findOne({ name: /Tushar/i });
    
    if (!user) {
      console.log('❌ Error: User "Tushar" not found in the database.');
      console.log('Tip: Check if you have seeded the users yet.');
      return;
    }

    console.log(`🔍 Found User: ${user.name} | Current ID: ${user.employeeId}`);

    // 3. Update the employeeId to match the device (5)
    // We store it as a String as required.
    user.employeeId = "5";
    await user.save();

    console.log(`\n🚀 SUCCESS: Updated "${user.name}" with Employee ID: "5"`);
    console.log('This will now correctly match the logs from the ZKTeco K60 device.');
    
  } catch (err: any) {
    console.error('\n❌ Update Failed!');
    if (err.code === 11000) {
      console.error('Error: Another user already has Employee ID "5". (Duplicate Key)');
    } else {
      console.error('Reason:', err.message);
    }
  } finally {
    console.log('--- Migration End ---');
    process.exit(0);
  }
}

updateTushar();
