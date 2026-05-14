import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGO_URI as string;

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);

    if (error.message?.includes('whitelist') || error.message?.includes('ECONNREFUSED')) {
      console.error('   👉 Add your current IP to MongoDB Atlas → Network Access → IP Allowlist.');
    }

    process.exit(1);
  }
};
