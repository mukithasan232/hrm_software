import { Request, Response } from 'express';
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
      // 1. Calculate Present Days from biometric logs
      const logs = await prisma.attendanceLog.findMany({
        where: {
          employeeId: emp.employeeId,
          timestamp: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        select: { timestamp: true }
      });

      // Count unique dates worked
      const uniqueDates = new Set(
        logs.map((log: any) => log.timestamp.toISOString().split('T')[0])
      );
      
      const presentDays = uniqueDates.size;
      const absentDays = totalDaysInMonth - presentDays;
      
      // 2. Calculate Gross Salary: (Base / Total) * Present
      const grossSalary = Math.round((emp.baseSalary / totalDaysInMonth) * presentDays);

      // 3. Upsert Payroll Record
      const payroll = await prisma.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: emp.employeeId,
            month: Number(month),
            year: Number(year)
          }
        },
        update: {
          totalDays: totalDaysInMonth,
          presentDays,
          absentDays,
          baseSalary: emp.baseSalary,
          grossSalary,
          status: 'Pending'
        },
        create: {
          employeeId: emp.employeeId,
          month: Number(month),
          year: Number(year),
          totalDays: totalDaysInMonth,
          presentDays,
          absentDays,
          baseSalary: emp.baseSalary,
          grossSalary,
          status: 'Pending'
        }
      });

      results.push({
        id: emp.id,
        name: emp.name,
        employeeId: emp.employeeId,
        baseSalary: emp.baseSalary,
        presentDays,
        absentDays,
        grossSalary,
        status: payroll.status
      });
    }

    res.status(200).json({
      message: `Payroll generated for ${results.length} employees for ${month}/${year}`,
      data: results
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
          select: { name: true, employeeId: true, department: true, designation: true }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.status(200).json(payrolls);
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
