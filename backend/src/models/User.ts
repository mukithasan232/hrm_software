import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['Admin', 'HR', 'Manager', 'Executive', 'Employee'], 
      default: 'Executive' 
    },
    department: { type: String },
    designation: { type: String },
    baseSalary: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    joiningDate: { type: Date, default: Date.now },
    profileImage: { type: String, default: '' },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
