import { getDeviceUsers } from '../src/services/zkService';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=============================================');
  console.log('🚀 Starting ZKTeco Device User Fetch Script');
  console.log('=============================================');

  try {
    console.log('Connecting to ZKTeco Device...');
    const users = await getDeviceUsers();
    
    if (users.length === 0) {
      console.log('⚠️ No users found on the device.');
    } else {
      console.log(`✅ Successfully fetched ${users.length} users from the device!`);
      users.forEach(u => {
        console.log(`- Device ID: ${u.userId} | Name: ${u.name || 'N/A'}`);
      });
    }

    console.log('=============================================');
    console.log('🎉 Script completed successfully!');
  } catch (error: any) {
    console.error('❌ Failed to fetch users from device:', error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
