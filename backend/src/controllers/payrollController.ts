import { Request, Response } from 'express';
import { User } from '../models/User';
import { Payroll } from '../models/Payroll';

export const getPendingPayroll = async (req: Request, res: Response) => {
  try {
    // All non-admin roles are payroll-eligible
    const employees = await User.find({ role: { $in: ['Executive', 'Manager', 'HR', 'Employee'] } }).select('-password');
    
    const pendingList = employees.map(emp => ({
      _id: emp._id,
      name: emp.name,
      designation: (emp as any).designation,
      department: (emp as any).department,
      base: emp.baseSalary,
      daysWorked: 22,
      lates: 4,
      status: 'Ready'
    }));

    res.status(200).json(pendingList);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching payroll', error: error.message });
  }
};

export const generatePayroll = async (req: Request, res: Response) => {
  try {
    const { month, year, employeeId } = req.body;
    
    // Auth user id from protect middleware
    const generatedBy = (req as any).user.id;

    const query: any = employeeId ? { _id: employeeId } : { role: { $in: ['Executive', 'Manager', 'HR', 'Employee'] } };
    const employees = await User.find(query);
    
    const results = [];

    for (const emp of employees) {
      // Logic: (Base Salary / 30) * Present Days. 
      // If late entries > 3, deduct half a day's pay.
      const presentDays = 22; // Hardcoded mock
      const totalDays = 30;
      const lateEntries = 4; // Hardcoded mock to trigger late penalty
      
      const perDaySalary = emp.baseSalary / totalDays;
      let finalSalary = perDaySalary * presentDays; // This implicitly deducts for unpaid leaves (absences)
      
      const deductionsArr = [];
      let totalDeductionsAmt = 0;
      
      // Unpaid leaves deduction
      if (lateEntries > 3) {
        const latePenalty = perDaySalary / 2;
        deductionsArr.push({ name: 'Late Penalty (>3 Lates)', amount: latePenalty });
        totalDeductionsAmt += latePenalty;
        finalSalary -= latePenalty;
      }

      // Upsert Payroll record
      const payrollRecord = await Payroll.findOneAndUpdate(
        { user: emp._id, month, year },
        {
          user: emp._id,
          month,
          year,
          basicSalary: emp.baseSalary,
          deductions: deductionsArr,
          netSalary: finalSalary,
          status: 'Pending',
          generatedBy
        },
        { new: true, upsert: true }
      );
      
      results.push({
        id: emp._id,
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
