import dotenv from 'dotenv';
import path from 'path';
// Load .env from the backend root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { connectDB } from '../config/db';
import { getDeviceAttendance } from '../services/zkService';

async function runSync() {
  console.log('--- Manual ZK Sync Start ---');
  try {
    // 1. Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to Database.');
    
    // 2. Trigger Device Sync
    console.log('📡 Contacting ZKTeco Device...');
    const result = await getDeviceAttendance();
    
    console.log('\n--- Sync Results ---');
    console.log(`📊 Total Records Found: ${result.total}`);
    console.log(`✅ Synced New:         ${result.synced}`);
    console.log(`⏭️  Skipped (Existing): ${result.skipped}`);
    
  } catch (err: any) {
    console.error('\n❌ Sync Failed!');
    console.error('Reason:', err.message);
  } finally {
    console.log('--- Manual ZK Sync End ---');
    process.exit(0);
  }
}

runSync();
