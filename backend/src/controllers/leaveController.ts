import { Request, Response } from 'express';
import { Leave } from '../models/Leave';
import { Notification } from '../models/Notification';
import { User } from '../models/User';

export const applyLeave = async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    const employeeId = (req as any).user.id;

    const attachment = req.file ? `/uploads/leaves/${req.file.filename}` : undefined;

    const leave = await Leave.create({
      employeeId, type, startDate, endDate, reason, attachment
    });

    const applyingUser = await User.findById(employeeId);
    
    const hrAndManagers = await User.find({ role: { $in: ['HR', 'Manager', 'Admin'] } });
    const notifications = hrAndManagers.map(u => ({
      userId: u._id,
      message: `${applyingUser?.name || 'An employee'} applied for ${type} leave.`,
      type: 'LeaveRequest'
    }));
    await Notification.insertMany(notifications);

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
      leaves = await Leave.find().populate('employeeId', 'name employeeId department').sort({ createdAt: -1 });
    } else {
      leaves = await Leave.find({ employeeId: (req as any).user.id }).sort({ createdAt: -1 });
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

    const leave: any = await Leave.findByIdAndUpdate(id, { status, reviewedBy: reviewerId }, { new: true }).populate('employeeId', 'name');
    
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    await Notification.create({
      userId: leave.employeeId._id,
      message: `Your ${leave.type} leave request has been ${status}.`,
      type: 'LeaveUpdate'
    });

    res.status(200).json({ message: `Leave ${status}`, leave });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating leave', error: error.message });
  }
};
