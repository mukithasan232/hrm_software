'use client';
import { useState } from 'react';
import { Calculator, Calendar as CalendarIcon, FileText, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function PayrollPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [payrollResults, setPayrollResults] = useState<any[]>([]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/payroll/generate', { month, year });
      setPayrollResults(res.data.data);
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white">Payroll Management</h1>
        <p className="text-gray-400 mt-1">Calculate and generate monthly salary slips.</p>
      </div>

      {/* Generation Card */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row items-end gap-6">
          <div className="flex-1 w-full space-y-2">
            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Select Month
            </label>
            <select 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1} className="bg-slate-900 text-white">
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full space-y-2">
            <label className="text-sm font-medium text-gray-400">Select Year</label>
            <input 
              type="number" 
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            ) : (
              <Calculator className="w-5 h-5" />
            )}
            Generate Payroll
          </button>
        </div>
      </div>

      {/* Salary Summary Table */}
      {payrollResults.length > 0 && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Salary Summary (Generated)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-gray-400 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Employee Name</th>
                  <th className="px-6 py-4 font-medium">Base Salary</th>
                  <th className="px-6 py-4 font-medium text-orange-400">Deductions</th>
                  <th className="px-6 py-4 font-medium text-green-400">Final Payable</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payrollResults.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{row.name}</td>
                    <td className="px-6 py-4 text-gray-300">${row.baseSalary?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-orange-400">-${row.deductionsAmount?.toFixed(2)}</td>
                    <td className="px-6 py-4 font-bold text-green-400">${row.netPayable?.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center w-fit gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
