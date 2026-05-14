import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    additions: [
      { name: String, amount: Number }
    ],
    deductions: [
      { name: String, amount: Number }
    ],
    netSalary: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Paid'], default: 'Pending' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Payroll = mongoose.model('Payroll', payrollSchema);
