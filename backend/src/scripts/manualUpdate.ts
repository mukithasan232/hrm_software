import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';
import { connectDB } from '../config/db';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * user-provided logic to update device ID
 */
const updateDeviceID = async () => {
  try {
    await connectDB();
    
    const user = await prisma.user.findFirst({
      where: { name: "Tushar" }
    });

    if (user) {
      const result = await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: "5" }
      });
      console.log("✅ User updated successfully:", result);
    } else {
      console.log("❌ User not found in database.");
    }
  } catch (err) {
    console.error("❌ Update failed:", err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

updateDeviceID();

