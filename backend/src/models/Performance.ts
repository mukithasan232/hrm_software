import mongoose from 'mongoose';

const performanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    punctualityScore: { type: Number, min: 0, max: 100, default: 0 },
    taskScore: { type: Number, min: 0, max: 100, default: 0 },
    managerRating: { type: Number, min: 1, max: 5, default: 3 },
    feedback: { type: String },
    calculatedOverallScore: { type: Number, min: 0, max: 100, default: 0 },
    isEOTM: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export interface IPerformance extends mongoose.Document {
  employeeId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  punctualityScore: number;
  taskScore: number;
  managerRating: number;
  feedback?: string;
  calculatedOverallScore: number;
  isEOTM: boolean;
}

export const Performance = mongoose.model<IPerformance>('Performance', performanceSchema);
