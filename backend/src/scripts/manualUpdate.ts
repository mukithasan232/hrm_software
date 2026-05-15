import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../config/db';
import { User } from '../models/User';

/**
 * user-provided logic to update device ID
 */
const updateDeviceID = async () => {
  try {
    await connectDB();
    
    const result = await User.findOneAndUpdate(
      { name: "Tushar" }, 
      { employeeId: "5" }, 
      { new: true }
    );
    
    if (result) {
      console.log("✅ User updated successfully:", result);
    } else {
      console.log("❌ User not found in database.");
    }
  } catch (err) {
    console.error("❌ Update failed:", err);
  } finally {
    process.exit(0);
  }
};

updateDeviceID();
