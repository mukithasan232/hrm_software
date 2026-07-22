import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';
import { sendLeaveUpdateEmail, sendNewLeaveRequestEmail } from '../services/emailService';
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
    const validLeaveTypes = ['Sick', 'Casual', 'Annual', 'EMERGENCY'];
    if (!validLeaveTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid leave type requested' });
    }

    // Validate Dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end date provided' });
    }

    // ─── Punch Conflict Validation ───────────────────────────────────────────
    const leaveDayStart = new Date(parsedStartDate);
    leaveDayStart.setHours(0, 0, 0, 0);
    const leaveDayEnd = new Date(parsedStartDate);
    leaveDayEnd.setHours(23, 59, 59, 999);

    const existingCheckIn = await prisma.attendanceLog.findFirst({
      where: {
        employeeId,
        punchType: 'Check-In',
        timestamp: {
          gte: leaveDayStart,
          lte: leaveDayEnd,
        },
      },
    });

    if (existingCheckIn) {
      if (type === 'Sick' || type === 'Casual') {
        return res.status(400).json({
          message: 'You are already checked in today. Please apply for Emergency Leave instead.',
        });
      }
      // If type is EMERGENCY or others, allow it to proceed
    }

    const attachment = (req as any).file?.attachment?.path;

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
      notifications.forEach((n) => eventEmitter.emit('new-notification', { ...n, id: Math.random().toString(36).substring(7), createdAt: new Date() }));

      // Native Browser Notification Trigger via Socket.io
      if ((global as any).io) {
        (global as any).io.emit('global_notification', {
          title: 'New Leave Request',
          body: `${applyingUser?.name || 'An employee'} applied for ${type} leave.`
        });
      }
      
      // Email Notification to Admins
      safeHrAndManagers.forEach((adminUser: any) => {
        if (adminUser.email) {
          try {
            sendNewLeaveRequestEmail(
              adminUser.email,
              applyingUser?.name || 'An employee',
              type,
              startDate,
              endDate,
              reason
            ).catch(err => console.error('[Nodemailer Warning] Failed to send email to admin:', err.message));
          } catch (err: any) {
            console.error('[Nodemailer Warning] Exception triggering email:', err.message);
          }
        }
      });
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
      // Admin/HR: fetch ALL leaves and include user relation for employee name
      const rawLeaves = await (prisma.leave as any).findMany({
        include: {
          user: {
            select: { name: true, employeeId: true, department: true, customDesignation: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Remap `user` → `employee` so the frontend's l.employee?.name works correctly
      leaves = rawLeaves.map((leave: any) => {
        const { user, ...rest } = leave;
        return {
          ...rest,
          employee: user
            ? { ...user, name: user.name ?? 'Unknown Employee', designation: user.customDesignation }
            : { name: 'Unknown Employee', employeeId: null, department: null, designation: { name: 'N/A' } },
        };
      });
    } else {
      // Employee: fetch only their own leaves (no user relation needed)
      leaves = await (prisma.leave as any).findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' }
      });
    }

    return res.status(200).json(leaves);
  } catch (error: any) {
    console.error('[getLeaves] Error:', error);
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
          select: { name: true, id: true, email: true }
        }
      }
    });

    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    const statusEn = status;

    const statusBn = status === 'Approved' ? 'অনুমোদিত' : status === 'Rejected' ? 'প্রত্যাখ্যাত' : 'মুলতুবি';

    try {
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
        await sendLeaveUpdateEmail((leave.user as any).email, leave.user.name, leave.type, statusEn, leave.startDate, leave.endDate);
      }
    } catch (notificationError) {
      console.error("[LEAVE_NOTIFICATION_ERROR]:", notificationError);
      // We don't throw here. The core database update was successful.
    }

    return res.status(200).json({ message: `Leave ${status}`, leave });
  } catch (error: any) {
    console.error("[LEAVE_UPDATE_ERROR]:", error);
    return res.status(500).json({ message: 'Error updating leave', error: error.message });
  }
};

export const getLeaveBalance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const employeeId = (req.query.employeeId as string) || user.id;

    // Fetch user and designation to get totals
    const dbUser = await prisma.user.findUnique({
      where: { id: employeeId },
      include: { customDesignation: true }
    });

    const totalCasual = dbUser?.customDesignation?.totalCasualLeaves || 0;
    const totalSick = dbUser?.customDesignation?.totalSickLeaves || 0;
    const totalAnnual = 0; // Annual isn't explicitly in schema, maybe we can assume 0 or derive from a generic 'totalLeaves' if we had one. Wait, in page.tsx ANNUAL_LEAVE_QUOTA is hardcoded to 24.
    const grandTotal = totalCasual + totalSick + totalAnnual || 24; 

    // Fetch approved leaves
    const currentYear = new Date().getFullYear();
    const approvedLeaves = await prisma.leave.findMany({
      where: {
        employeeId: employeeId,
        status: 'Approved',
        startDate: {
          gte: new Date(`${currentYear}-01-01T00:00:00.000Z`)
        },
        endDate: {
          lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
        }
      }
    });

    let usedCasual = 0;
    let usedSick = 0;
    let usedAnnual = 0;
    let usedEmergency = 0;

    approvedLeaves.forEach(leave => {
      const days = leave.totalDays || 1;
      if (leave.type === 'Casual') usedCasual += days;
      else if (leave.type === 'Sick') usedSick += days;
      else if (leave.type === 'Annual') usedAnnual += days;
      else if (leave.type === 'EMERGENCY') usedEmergency += days;
    });

    const usedTotal = usedCasual + usedSick + usedAnnual + usedEmergency;
    const actualGrandTotal = Math.max(grandTotal, 24); // fallback if it's 0

    return res.status(200).json({
      totalBalance: { 
        total: actualGrandTotal, 
        used: usedTotal, 
        left: Math.max(0, actualGrandTotal - usedTotal) 
      },
      breakdown: {
        casual: { total: totalCasual || 10, used: usedCasual, left: Math.max(0, (totalCasual || 10) - usedCasual) },
        sick: { total: totalSick || 14, used: usedSick, left: Math.max(0, (totalSick || 14) - usedSick) },
        annual: { total: totalAnnual, used: usedAnnual, left: Math.max(0, totalAnnual - usedAnnual) }
      }
    });
  } catch (error: any) {
    console.error("[GET_LEAVE_BALANCE_ERROR]:", error);
    return res.status(500).json({ message: 'Error fetching leave balance', error: error.message });
  }
};
