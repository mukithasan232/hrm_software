import { prisma } from '../lib/prisma';

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to MongoDB successfully.');
  } catch (error: any) {
    console.error(`❌ Prisma connection error: ${error.message}`);
    
    if (error.message?.includes('whitelist') || error.message?.includes('ECONNREFUSED')) {
      console.error('   👉 Add your current IP to MongoDB Atlas → Network Access → IP Allowlist.');
    }

    process.exit(1);
  }
};

