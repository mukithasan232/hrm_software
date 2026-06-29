import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';
import { sendLeaveUpdateEmail } from '../services/emailService';
import { eventEmitter } from '../lib/eventEmitter';

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
    const { type, startDate, endDate, reason, targetEmployeeId } = req.body;
    
    // Securely extract the user ID from the session (JWT token)
    let employeeId = (req as any).user.id;
    if (!employeeId) {
      return res.status(401).json({ message: 'Unauthorized: User session missing' });
    }

    if (targetEmployeeId && targetEmployeeId !== employeeId) {
      const userDesig = (req as any).user.customDesignation?.name || (req as any).user.designation;
      const isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HR', 'HR Manager', 'Manager'].includes(userDesig);
      if (isAdmin) {
        employeeId = targetEmployeeId;
      } else {
        return res.status(403).json({ message: 'Forbidden: Only admins can assign leave to other employees' });
      }
    }

    // Validate ENUM-like leaveType to ensure frontend consistency
    const validLeaveTypes = ['Sick', 'Casual', 'Annual'];
    if (!validLeaveTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid leave type requested' });
    }

    // Validate Dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end date provided' });
    }

    const attachment = req.file ? `/api/storage/leaves/${req.file.filename}` : undefined;

    // ০ থেকে দিন সংখ্যা হিসাব কনফ্লিক্ট এড়াতে গ্যারান্টিড ম্যাথ অপারেশন
    const totalDays = Math.ceil((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await (prisma.leave as any).create({
      data: {
        employeeId, // Relational constraint strictly enforced by session ID
        type,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        reason,
        status: 'Pending',
        totalDays,
        ...(attachment ? { attachment } : {}) // অ্যাটাচমেন্ট থাকলে তবেই অবজেক্টে পুশ হবে
      }
    });

    const applyingUser = await prisma.user.findUnique({ where: { id: employeeId } });

    const hrAndManagers = await prisma.user.findMany({
      where: {
        customDesignation: { name: { in: ['HR', 'Manager', 'HRM Manager', 'Admin', 'Super Admin', 'System Administrator'] } }
      }
    });

    const safeHrAndManagers = Array.isArray(hrAndManagers) ? hrAndManagers : [];
    const notifications = safeHrAndManagers.map((u: any) => ({
      userId: u.id,
      titleEn: 'New Leave Request',
      titleBn: 'নতুন ছুটির আবেদন',
      messageEn: `${applyingUser?.name || 'An employee'} applied for ${type} leave.`,
      messageBn: `${applyingUser?.name || 'একজন কর্মচারী'} ${type} ছুটির আবেদন করেছেন।`,
      type: 'LEAVE',
      referenceId: leave.id
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications
      });
      // Broadcast the notifications in real-time
      // Note: createMany doesn't return the IDs, but for real-time we mainly need the payload to show in the dropdown
      notifications.forEach((n) => eventEmitter.emit('new-notification', { ...n, id: Math.random().toString(36).substring(7), createdAt: new Date() }));
    }

    return res.status(201).json({ message: 'Leave applied successfully', leave });
  } catch (error: any) {
    console.error('[Leave Application Error]:', error);
    return res.status(500).json({ message: 'Error applying leave. Please ensure all details are correct.', error: error.message });
  }
};

export const getLeaves = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.designation;
    const employeeId = (req as any).user.id;
    let leaves;

    if (['HR', 'Manager', 'HRM Manager', 'Admin', 'Super Admin', 'System Administrator'].includes(userRole)) {
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

    const statusEn = status;

    const statusBn = status === 'Approved' ? 'অনুমোদিত' : status === 'Rejected' ? 'প্রত্যাখ্যাত' : 'মুলতুবি';

    const newNotification = await prisma.notification.create({
      data: {
        userId: leave.employeeId,
        titleEn: `Leave Request ${statusEn}`,
        titleBn: `ছুটির আবেদন ${statusBn}`,
        messageEn: `Your ${leave.type} leave request has been ${statusEn}.`,
        messageBn: `আপনার ${leave.type} ছুটির আবেদনটি ${statusBn} হয়েছে।`,
        type: 'LEAVE',
        referenceId: leave.id
      }
    });
    
    eventEmitter.emit('new-notification', newNotification);

    if (leave.user?.email && leave.user?.name) {
      await sendLeaveUpdateEmail((leave.user as any).email, leave.user.name, leave.type, statusEn);
    }

    return res.status(200).json({ message: `Leave ${status}`, leave });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error updating leave', error: error.message });
  }
};
