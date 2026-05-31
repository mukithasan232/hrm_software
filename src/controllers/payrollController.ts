import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';

/**
 * @desc    Generate/Upsert payroll for all active employees for a specific month
 * @route   POST /api/payroll/generate
 * @access  Admin
 */
export const generateMonthlyPayroll = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: 'Please provide month (1-12) and year.' });
    }

    const employees = await prisma.user.findMany({
      where: { isActive: true }
    });

    const results = [];
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    for (const emp of employees) {
      // Schema constraint: Foreign keys like AttendanceLog.employeeId and Leave.employeeId
      // actually reference User.id (UUID), not User.employeeId string.
      if (!emp.id) continue;

      // 1. Calculate Present Days from biometric logs
      const logs = await prisma.attendanceLog.findMany({
        where: {
          employeeId: emp.id, // Targeting employeeId field which references User.id
          timestamp: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        select: { timestamp: true }
      });

      // Count unique dates worked
      const safeLogsForPayroll = Array.isArray(logs) ? logs : [];
      const uniqueDates = new Set(
        safeLogsForPayroll.map((log: any) => log.timestamp.toISOString().split('T')[0])
      );
      
      const presentDays = uniqueDates.size;

      // 2. Calculate Total Leave Reductions
      const leaves = await prisma.leave.findMany({
        where: {
          employeeId: emp.id, // Targeting employeeId field which references User.id
          status: 'Approved', // Only count approved leaves
          startDate: { lte: endOfMonth },
          endDate: { gte: startOfMonth }
        }
      });

      // Safely parse totalDays from Leave table
      let approvedLeaveDays = 0;
      for (const leave of leaves) {
        // We only want to count leave days that fall within the current month
        const leaveStart = leave.startDate < startOfMonth ? startOfMonth : leave.startDate;
        const leaveEnd = leave.endDate > endOfMonth ? endOfMonth : leave.endDate;
        
        // Calculate days between leaveStart and leaveEnd
        const diffTime = Math.abs(leaveEnd.getTime() - leaveStart.getTime());
        const daysInMonth = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Fallback to the requested constraint of safely parsing totalDays property 
        // if exact date overlap is tricky or if the leave is entirely inside this month.
        const effectiveDays = Math.min(daysInMonth, leave.totalDays || 0);
        approvedLeaveDays += effectiveDays;
      }

      // Calculate absent days (Total - Present - Approved Leaves)
      let absentDays = totalDaysInMonth - presentDays - approvedLeaveDays;
      if (absentDays < 0) absentDays = 0;
      
      const baseSalary = emp.baseSalary || 0;

      // 3. Calculate Gross Salary: (Base / Total) * (Present + Approved Leave)
      const payableDays = presentDays + approvedLeaveDays;
      const grossSalary = totalDaysInMonth > 0 
        ? Math.round((baseSalary / totalDaysInMonth) * payableDays)
        : 0;

      // 4. Manual Upsert strictly mapping schema-approved keys
      const existingPayroll = await prisma.payroll.findFirst({
        where: {
          employeeId: emp.id,
          month: Number(month),
          year: Number(year)
        }
      });

      const payloadData = {
        employeeId: emp.id,
        month: Number(month),
        year: Number(year),
        baseSalary,
        grossSalary,
        presentDays,
        absentDays,
        totalDays: totalDaysInMonth,
        status: 'Pending'
      };

      if (existingPayroll) {
        await prisma.payroll.update({
          where: { id: existingPayroll.id },
          data: payloadData
        });
      } else {
        await prisma.payroll.create({
          data: payloadData
        });
      }
    }

    // Fetch and return the fully populated payroll records for this month & year
    const finalPayrolls = await prisma.payroll.findMany({
      where: {
        month: Number(month),
        year: Number(year)
      },
      include: {
        user: {
          select: { name: true, employeeId: true, department: true, customDesignation: true }
        }
      }
    });

    res.status(200).json({
      message: `Payroll generated successfully for ${finalPayrolls.length} employees for ${month}/${year}`,
      data: finalPayrolls.map(p => ({ ...p, user: { ...p.user, designation: (p.user as any)?.customDesignation } }))
    });
  } catch (error: any) {
    console.error('❌ [generateMonthlyPayroll] Error:', error);
    res.status(500).json({ message: 'Error generating payroll', error: error.message });
  }
};

/**
 * @desc    Get all payroll records
 * @route   GET /api/payroll
 * @access  Admin/HR
 */
export const getAllPayrolls = async (req: Request, res: Response) => {
  try {
    const { month, year, status } = req.query;
    
    const where: any = {};
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);
    if (status) where.status = status as string;

    const payrolls = await prisma.payroll.findMany({
      where,
      include: {
        user: {
          select: { name: true, employeeId: true, department: true, customDesignation: true }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.status(200).json(payrolls.map(p => ({ ...p, user: { ...p.user, designation: (p.user as any)?.customDesignation } })));
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching payrolls', error: error.message });
  }
};

/**
 * @desc    Update payroll status (e.g., mark as Paid)
 * @route   PATCH /api/payroll/:id
 * @access  Admin
 */
export const updatePayrollStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const payroll = await prisma.payroll.update({
      where: { id: id as string },
      data: { status }
    });

    res.status(200).json({ message: 'Payroll status updated', payroll });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating payroll', error: error.message });
  }
};
