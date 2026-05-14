import mongoose from 'mongoose';

const attendanceLogSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    punchType: { type: String, enum: ['CheckIn', 'CheckOut', 'Unknown'], default: 'Unknown' },
    deviceId: { type: String }
  },
  { timestamps: true }
);

// Optional: Prevent duplicate logs for the exact same punch from same device
attendanceLogSchema.index({ employeeId: 1, timestamp: 1 }, { unique: true });

export const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);
