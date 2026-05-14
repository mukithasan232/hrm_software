import mongoose from 'mongoose';

const dailyAttendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    firstPunch: { type: Date },
    lastPunch: { type: Date },
    totalWorkingMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ['Present', 'Absent', 'Late', 'Half-Day'], required: true },
  },
  { timestamps: true }
);

// One record per user per day
dailyAttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

export const DailyAttendance = mongoose.model('DailyAttendance', dailyAttendanceSchema);
