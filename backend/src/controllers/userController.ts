import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import path from 'path';

export const getEmployees = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, designation, department, phone } = req.body;

    const updates: any = {};
    if (name) updates.name = name;
    if (designation) updates.designation = designation;
    if (department) updates.department = department;
    if (phone) updates.phone = phone;

    // If a file was uploaded, set its URL
    if ((req as any).file) {
      updates.profileImage = `/uploads/avatars/${(req as any).file.filename}`;
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, department, designation, baseSalary, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { name, role, department, designation, baseSalary, isActive },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Employee not found' });
    res.status(200).json({ message: 'Employee updated', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update employee', error: error.message });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { employeeId, name, email, password, role, department, designation, baseSalary } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (exists) {
      return res.status(400).json({ message: 'An employee with this email or Employee ID already exists.' });
    }

    const hashed = await bcrypt.hash(password || 'password123', 10);

    const user = await User.create({
      employeeId,
      name,
      email,
      password: hashed,
      role: role || 'Executive',
      department,
      designation,
      baseSalary: Number(baseSalary) || 0,
      joiningDate: new Date(),
    });

    res.status(201).json({
      message: 'Employee created successfully',
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
};

export const toggleEmployeeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const emp = await User.findById(id);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    emp.isActive = !emp.isActive;
    await emp.save();
    res.status(200).json({ message: `Employee ${emp.isActive ? 'activated' : 'deactivated'}`, isActive: emp.isActive });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to toggle status', error: error.message });
  }
};
