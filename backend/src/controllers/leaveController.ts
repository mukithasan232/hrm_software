import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const applyLeave = async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    const employeeId = (req as any).user.id;

    const attachment = req.file ? `/uploads/leaves/${req.file.filename}` : undefined;

    const leave = await prisma.leave.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        attachment
      }
    });

    const applyingUser = await prisma.user.findUnique({ where: { id: employeeId } });
    
    const hrAndManagers = await prisma.user.findMany({
      where: {
        role: { in: ['HR', 'Manager', 'Admin'] }
      }
    });

    const notifications = hrAndManagers.map((u: any) => ({
      userId: u.id,
      message: `${applyingUser?.name || 'An employee'} applied for ${type} leave.`,
      type: 'LeaveRequest'
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    res.status(201).json({ message: 'Leave applied successfully', leave });
  } catch (error: any) {
    res.status(500).json({ message: 'Error applying leave', error: error.message });
  }
};

export const getLeaves = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    let leaves;
    if (['HR', 'Manager', 'Admin'].includes(userRole)) {
      leaves = await prisma.leave.findMany({
        include: {
          employee: {
            select: { name: true, employeeId: true, department: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      leaves = await prisma.leave.findMany({
        where: { employeeId: (req as any).user.id },
        orderBy: { createdAt: 'desc' }
      });
    }
    res.status(200).json(leaves);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching leaves', error: error.message });
  }
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const reviewerId = (req as any).user.id;

    const leave = await prisma.leave.update({
      where: { id: id as string },
      data: { status, reviewedById: reviewerId },
      include: {
        employee: {
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

    res.status(200).json({ message: `Leave ${status}`, leave });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating leave', error: error.message });
  }
};
