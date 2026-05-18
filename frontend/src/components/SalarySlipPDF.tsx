import React from 'react';

interface SalarySlipPDFProps {
  payroll: any;
  monthName: string;
}

export const SalarySlipPDF: React.FC<SalarySlipPDFProps> = ({ payroll, monthName }) => {
  if (!payroll) return null;

  const empName = payroll.user?.name || payroll.name || 'N/A';
  const employeeId = payroll.employeeId || 'N/A';
  const designation = payroll.user?.designation || 'N/A';
  const department = payroll.user?.department || 'N/A';
  const month = monthName || String(payroll.month);
  const year = payroll.year;
  const totalDays = payroll.totalDays || 30;
  const presentDays = payroll.presentDays || 0;
  const absentDays = payroll.absentDays || 0;
  const baseSalary = payroll.baseSalary || 0;
  const grossSalary = payroll.grossSalary || 0;

  return (
    <div 
      id={`payslip-${payroll.id}`}
      className="bg-white text-slate-800 p-8 font-sans w-[800px] border border-slate-200"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-indigo-900">Fix  Any Photo</h1>
          <p className="text-xs text-slate-500 mt-1">Rangpur, Bangladesh</p>
          <p className="text-xs text-slate-500">Email: hr@fixanyphoto.net | Web: www.fixanyphoto.net</p>
        </div>
        <div className="text-right">
          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg inline-block font-semibold text-sm tracking-wider uppercase">
            Payslip
          </div>
          <p className="text-xs text-slate-500 mt-2">Statement for the Month of</p>
          <p className="text-sm font-bold text-indigo-900">{month}, {year}</p>
        </div>
      </div>

      {/* Employee Details */}
      <div className="my-6 grid grid-cols-2 gap-x-8 gap-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex justify-between border-b border-slate-200 pb-1.5">
          <span className="text-xs font-semibold text-slate-500">Employee Name:</span>
          <span className="text-xs font-bold text-slate-800">{empName}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 pb-1.5">
          <span className="text-xs font-semibold text-slate-500">Employee ID:</span>
          <span className="text-xs font-bold text-slate-800">{employeeId}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 pb-1.5">
          <span className="text-xs font-semibold text-slate-500">Designation:</span>
          <span className="text-xs font-bold text-slate-800">{designation}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 pb-1.5">
          <span className="text-xs font-semibold text-slate-500">Department:</span>
          <span className="text-xs font-bold text-slate-800">{department}</span>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Attendance Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Working Days</p>
            <p className="text-lg font-extrabold text-slate-700 mt-0.5">{totalDays}</p>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-emerald-600">Present Days</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{presentDays}</p>
          </div>
          <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-rose-600">Absent Days</p>
            <p className="text-lg font-extrabold text-rose-700 mt-0.5">{absentDays}</p>
          </div>
        </div>
      </div>

      {/* Salary Details Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
              <th className="px-5 py-3 font-semibold">Earnings & Allowances</th>
              <th className="px-5 py-3 text-right font-semibold">Amount (BDT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="text-xs">
              <td className="px-5 py-3.5 text-slate-500">Basic Base Salary</td>
              <td className="px-5 py-3.5 text-right font-semibold text-slate-700">৳{baseSalary.toLocaleString()}</td>
            </tr>
            <tr className="text-xs">
              <td className="px-5 py-3.5 text-slate-500">House Rent Allowance (Included in Basic)</td>
              <td className="px-5 py-3.5 text-right font-medium text-slate-400">৳0</td>
            </tr>
            <tr className="text-xs">
              <td className="px-5 py-3.5 text-slate-500">Medical Allowance (Included in Basic)</td>
              <td className="px-5 py-3.5 text-right font-medium text-slate-400">৳0</td>
            </tr>
            <tr className="text-xs bg-slate-50/50 border-t border-slate-200">
              <td className="px-5 py-4 font-bold text-slate-700">Total Gross Salary (Pro-rated)</td>
              <td className="px-5 py-4 text-right font-extrabold text-indigo-700 text-sm">৳{grossSalary.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Details */}
      <div className="flex justify-between items-end mt-16 pt-6 border-t border-slate-200">
        <div className="text-xs text-slate-400">
          <p>Note: This is a system-generated payslip and does not require a physical seal.</p>
          <p className="mt-1">Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
        <div className="text-center w-40">
          <div className="border-b border-slate-400 pb-1 mb-1.5 h-8"></div>
          <p className="text-xs font-bold text-indigo-900">HR Manager</p>
          <p className="text-[10px] text-slate-400">Fix Any Photo</p>
        </div>
      </div>
    </div>
  );
};
