import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getPendingPayroll = async (req: Request, res: Response) => {
  try {
    const history = await prisma.payroll.findMany({
      where: { status: 'Pending' },
      include: {
        user: {
          select: { name: true, employeeId: true }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    res.status(200).json(history);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching pending payroll', error: error.message });
  }
};

export const getPayrollHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const history = await prisma.payroll.findMany({
      where: { userId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    res.status(200).json(history);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching payroll history', error: error.message });
  }
};

export const generatePayroll = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;
    const generatedBy = (req as any).user.id;

    if (!month || !year) {
      return res.status(400).json({ message: 'Please provide month and year' });
    }

    const employees = await prisma.user.findMany({
      where: { isActive: true }
    });
    
    const results = [];

    for (const emp of employees) {
      // Logic: (Base Salary / 30) * Present Days. 
      // If late entries > 3, deduct half a day's pay.
      const presentDays = 22; // Hardcoded mock
      const totalDays = 30;
      const lateEntries = 4; // Hardcoded mock to trigger late penalty
      
      const perDaySalary = emp.baseSalary / totalDays;
      let finalSalary = perDaySalary * presentDays; // This implicitly deducts for unpaid leaves (absences)
      
      const deductionsArr: any[] = [];
      let totalDeductionsAmt = 0;
      
      // Unpaid leaves deduction
      if (lateEntries > 3) {
        const latePenalty = perDaySalary / 2;
        deductionsArr.push({ name: 'Late Penalty (>3 Lates)', amount: latePenalty });
        totalDeductionsAmt += latePenalty;
        finalSalary -= latePenalty;
      }

      // Upsert Payroll record
      const payrollRecord = await prisma.payroll.upsert({
        where: {
          userId_month_year: {
            userId: emp.id,
            month: Number(month),
            year: Number(year)
          }
        },
        create: {
          userId: emp.id,
          month: Number(month),
          year: Number(year),
          basicSalary: emp.baseSalary,
          deductions: deductionsArr,
          netSalary: finalSalary,
          status: 'Pending',
          generatedById: generatedBy
        },
        update: {
          basicSalary: emp.baseSalary,
          deductions: deductionsArr,
          netSalary: finalSalary,
          generatedById: generatedBy
        }
      });
      
      results.push({
        id: emp.id,
        name: emp.name,
        baseSalary: emp.baseSalary,
        presentDays,
        lateEntries,
        deductionsAmount: totalDeductionsAmt,
        netPayable: finalSalary,
        status: payrollRecord.status
      });
    }

    res.status(200).json({ message: 'Payroll generated successfully', data: results });
  } catch (error: any) {
    res.status(500).json({ message: 'Error generating payroll', error: error.message });
  }
};
