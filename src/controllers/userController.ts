import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

export const getEmployees = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        baseSalary: true,
        isActive: true,
        joiningDate: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        baseSalary: true,
        isActive: true,
        joiningDate: true,
        profileImage: true,
      }
    });
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

    const data: any = {};
    if (name) data.name = name;
    if (designation) data.designation = designation;
    if (department) data.department = department;
    // Note: Phone is not in the Prisma schema yet, I'll ignore it or update schema later if needed.
    // Based on User.ts, phone wasn't there either, only in the controller's body destructuring.

    if ((req as any).file) {
      data.profileImage = `/uploads/avatars/${(req as any).file.filename}`;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        profileImage: true,
      }
    });
    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, department, designation, baseSalary, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: id as string },
      data: {
        name,
        role,
        department,
        designation,
        baseSalary: baseSalary ? Number(baseSalary) : undefined,
        isActive
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        baseSalary: true,
        isActive: true,
      }
    });

    if (!user) return res.status(404).json({ message: 'Employee not found' });
    res.status(200).json({ message: 'Employee updated', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update employee', error: error.message });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { employeeId, name, email, password, role, department, designation, baseSalary } = req.body;

    const exists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { employeeId }]
      }
    });

    if (exists) {
      return res.status(400).json({ message: 'An employee with this email or Employee ID already exists.' });
    }

    const hashed = await bcrypt.hash(password || 'password123', 10);

    const user = await prisma.user.create({
      data: {
        employeeId,
        name,
        email,
        password: hashed,
        role: role || 'Executive',
        department,
        designation,
        baseSalary: Number(baseSalary) || 0,
        joiningDate: new Date(),
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      message: 'Employee created successfully',
      user: userWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
};

export const toggleEmployeeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const emp = await prisma.user.findUnique({ where: { id: id as string } });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    
    const updated = await prisma.user.update({
      where: { id: id as string },
      data: { isActive: !emp.isActive }
    });

    res.status(200).json({ message: `Employee ${updated.isActive ? 'activated' : 'deactivated'}`, isActive: updated.isActive });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to toggle status', error: error.message });
  }
};

// @desc    Seed a specific test user for biometric matching
// @route   POST /api/users/seed-test-user
// @access  Public (for dev/testing)
export const seedTestUser = async (req: Request, res: Response) => {
  try {
    const targetEmployeeId = "5";
    const hashedPassword = await bcrypt.hash('password123', 10);

    const userData = {
      name: 'Tushar',
      email: 'tushar@example.com',
      password: hashedPassword,
      role: 'Employee' as const,
      employeeId: targetEmployeeId,
      baseSalary: 45000,
      department: 'Engineering',
      designation: 'Software Developer',
      isActive: true
    };

    const user = await prisma.user.upsert({
      where: { employeeId: targetEmployeeId },
      update: userData,
      create: userData
    });

    console.log('[UserController] ✅ Seeded Test User:', user.employeeId);
    res.status(200).json({ message: 'Test user seeded successfully', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to seed test user', error: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Find the user first to retrieve their unique employeeId
    const emp = await prisma.user.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    
    const employeeId = emp.employeeId as string;

    console.log(`🗑️ [deleteEmployee] Initiating transactional cascade delete for employee ${emp.name} (ID: ${employeeId})`);

    // Delete in a single Prisma transaction to maintain relational integrity
    await prisma.$transaction([
      // 1. Delete Daily Attendance records
      prisma.dailyAttendance.deleteMany({ where: { userId: id } }),
      // 2. Delete Attendance Logs
      prisma.attendanceLog.deleteMany({ where: { employeeId } }),
      // 3. Delete Leaves (both requested by employee and reviewed by them if HR/Admin)
      prisma.leave.deleteMany({ where: { OR: [{ employeeId: id }, { reviewedById: id }] } }),
      // 4. Delete Notifications
      prisma.notification.deleteMany({ where: { userId: id } }),
      // 5. Delete Payroll history
      prisma.payroll.deleteMany({ where: { employeeId } }),
      // 6. Delete Performance evaluations
      prisma.performance.deleteMany({ where: { employeeId: id } }),
      // 7. Finally, delete the User record
      prisma.user.delete({ where: { id } })
    ]);

    console.log(`✅ [deleteEmployee] Successfully deleted employee ${emp.name} and all related records.`);
    res.status(200).json({ message: 'Employee and all associated records deleted successfully.' });
  } catch (error: any) {
    console.error('❌ [deleteEmployee] Error deleting employee:', error);
    res.status(500).json({ message: 'Failed to delete employee', error: error.message });
  }
};
