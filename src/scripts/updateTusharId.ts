import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';
import { connectDB } from '../config/db';

// Load .env from backend root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function updateTushar() {
  console.log('--- Database Migration: Update Tushar Device ID ---');
  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Search for Tushar (Case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        name: { contains: 'Tushar' }
      }
    });
    
    if (!user) {
      console.log('❌ Error: User "Tushar" not found in the database.');
      console.log('Tip: Check if you have seeded the users yet.');
      return;
    }

    console.log(`🔍 Found User: ${user.name} | Current ID: ${user.employeeId}`);

    // 3. Update the employeeId to match the device (5)
    await prisma.user.update({
      where: { id: user.id },
      data: { employeeId: "5" }
    });

    console.log(`\n🚀 SUCCESS: Updated "${user.name}" with Employee ID: "5"`);
    console.log('This will now correctly match the logs from the ZKTeco K60 device.');
    
  } catch (err: any) {
    console.error('\n❌ Update Failed!');
    console.error('Reason:', err.message);
  } finally {
    console.log('--- Migration End ---');
    await prisma.$disconnect();
    process.exit(0);
  }
}

updateTushar();

