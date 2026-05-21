import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';

// 💡 Multer-এর জন্য এক্সপ্রেস Request টাইপকে সম্পূর্ণ টাইপসেফ করা হলো
interface MulterRequest extends Omit<Request, 'file' | 'files'> {
  file?: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  };
  files?: any;
}

export const applyLeave = async (req: MulterRequest, res: Response) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    const employeeId = (req as any).user.id;

    const attachment = req.file ? `/uploads/leaves/${req.file.filename}` : undefined;

    // ০ থেকে দিন সংখ্যা হিসাব কনফ্লিক্ট এড়াতে গ্যারান্টিড ম্যাথ অপারেশন
    const totalDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await (prisma.leave as any).create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: 'Pending',
        totalDays,
        ...(attachment ? { attachment } : {}) // অ্যাটাচমেন্ট থাকলে তবেই অবজেক্টে পুশ হবে
      }
    });

    const applyingUser = await prisma.user.findUnique({ where: { id: employeeId } });

    const hrAndManagers = await prisma.user.findMany({
      where: {
        role: { in: ['HR', 'Manager', 'Admin'] }
      }
    });

    const safeHrAndManagers = Array.isArray(hrAndManagers) ? hrAndManagers : [];
    const notifications = safeHrAndManagers.map((u: any) => ({
      userId: u.id,
      message: `${applyingUser?.name || 'An employee'} applied for ${type} leave.`,
      type: 'LeaveRequest'
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications
      });
    }

    return res.status(201).json({ message: 'Leave applied successfully', leave });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error applying leave', error: error.message });
  }
};

export const getLeaves = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    const employeeId = (req as any).user.id;
    let leaves;

    if (['HR', 'Manager', 'Admin'].includes(userRole)) {
      leaves = await (prisma.leave as any).findMany({
        include: {
          user: {
            select: { name: true, employeeId: true, department: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      leaves = await (prisma.leave as any).findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' }
      });
    }
    return res.status(200).json(leaves);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching leaves', error: error.message });
  }
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const leave = await (prisma.leave as any).update({
      where: { id: id as string },
      data: { status },
      include: {
        user: {
          select: { name: true, id: true }
        }
      }
    });

    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    await prisma.notification.create({
      data: {
        userId: leave.employeeId,
        message: `Your ${leave.type} leave request has been ${status}.`,
        type: 'LeaveUpdate'
      }
    });

    return res.status(200).json({ message: `Leave ${status}`, leave });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error updating leave', error: error.message });
  }
};