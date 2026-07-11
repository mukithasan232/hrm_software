'use client';
import { useState, useEffect } from 'react';
import { Calculator, Calendar as CalendarIcon, FileText, CheckCircle2, Download } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { SalarySlipPDF } from '@/components/SalarySlipPDF';

export default function PayrollPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [payrollResults, setPayrollResults] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchPayrolls = async () => {
    try {
      setGenerating(true);
      const res = await api.get(`/payroll?month=${month}&year=${year}`);
      setPayrollResults(res.data);
    } catch (error) {
      console.error('Failed to fetch payroll history');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, [month, year]);

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

  const handleDownloadPDF = async (row: any) => {
    try {
      setDownloadingId(row.id);
      
      // Delay slightly to ensure template is fully initialized in the DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      const element = document.getElementById(`payslip-${row.id}`);
      if (!element) {
        toast.error('Failed to find payslip template');
        return;
      }

      // Create a temporary hidden iframe to isolate the html2canvas rendering
      // This completely shields html2canvas from Tailwind v4's modern CSS variables (like lab(), oklch())
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '800px';
      iframe.style.height = '1130px'; // standard A4 aspect height for 800px width
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        toast.error('Failed to initialize document frame');
        document.body.removeChild(iframe);
        return;
      }

      // Write standard styles matching our Payslip layout (isolated from Tailwind CSS v4 dependencies)
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <head>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                -webkit-print-color-adjust: exact;
              }
              .bg-white { background-color: #ffffff; }
              .text-slate-800 { color: #1e293b; }
              .p-8 { padding: 2rem; }
              .w-\\[800px\\] { width: 800px; }
              .border { border: 1px solid #e2e8f0; }
              .border-slate-200 { border-color: #e2e8f0; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-start { align-items: flex-start; }
              .items-end { align-items: flex-end; }
              .border-b-2 { border-bottom-width: 2px; }
              .border-indigo-600 { border-color: #4f46e5; }
              .pb-6 { padding-bottom: 1.5rem; }
              .pb-1 { padding-bottom: 0.25rem; }
              .pb-1\\.5 { padding-bottom: 0.375rem; }
              .text-2xl { font-size: 1.5rem; line-height: 2rem; }
              .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
              .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
              .text-xs { font-size: 0.75rem; line-height: 1rem; }
              .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
              .text-\\[10px\\] { font-size: 10px; }
              .font-bold { font-weight: 700; }
              .font-semibold { font-weight: 600; }
              .font-medium { font-weight: 500; }
              .font-extrabold { font-weight: 800; }
              .text-indigo-900 { color: #1e1b4b; }
              .text-indigo-700 { color: #4338ca; }
              .text-slate-500 { color: #64748b; }
              .text-slate-400 { color: #94a3b8; }
              .text-slate-700 { color: #334155; }
              .bg-indigo-600 { background-color: #4f46e5; }
              .text-white { color: #ffffff; }
              .px-4 { padding-left: 1rem; padding-right: 1rem; }
              .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
              .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
              .py-3\\.5 { padding-top: 0.875rem; padding-bottom: 0.875rem; }
              .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
              .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
              .rounded-lg { border-radius: 0.5rem; }
              .rounded-xl { border-radius: 0.75rem; }
              .tracking-wider { letter-spacing: 0.05em; }
              .uppercase { text-transform: uppercase; }
              .mt-1 { margin-top: 0.25rem; }
              .mt-2 { margin-top: 0.5rem; }
              .mt-0\\.5 { margin-top: 0.125rem; }
              .mt-16 { margin-top: 4rem; }
              .pt-6 { padding-top: 1.5rem; }
              .mb-1\\.5 { margin-bottom: 0.375rem; }
              .mb-2\\.5 { margin-bottom: 0.625rem; }
              .mb-6 { margin-bottom: 1.5rem; }
              .mb-8 { margin-bottom: 2rem; }
              .h-8 { height: 2rem; }
              .w-40 { width: 10rem; }
              .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
              .grid { display: grid; }
              .grid-cols-1 md:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .grid-cols-1 md:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              .gap-x-8 { column-gap: 2rem; }
              .gap-y-3 { row-gap: 0.75rem; }
              .gap-4 { gap: 1rem; }
              .bg-slate-50 { background-color: #f8fafc; }
              .bg-slate-100 { background-color: #f1f5f9; }
              .bg-emerald-50\\/50 { background-color: rgba(236, 253, 245, 0.5); }
              .bg-rose-50\\/50 { background-color: rgba(254, 242, 242, 0.5); }
              .border-slate-100 { border-color: #f1f5f9; }
              .border-emerald-100 { border-color: #d1fae5; }
              .border-rose-100 { border-color: #fee2e2; }
              .text-emerald-600 { color: #059669; }
              .text-emerald-700 { color: #047857; }
              .text-rose-600 { color: #e11d48; }
              .text-rose-700 { color: #be123c; }
              .w-full { width: 100%; }
              .border-collapse { border-collapse: collapse; }
              .divide-y > * + * { border-top: 1px solid #f1f5f9; }
              .border-t { border-top: 1px solid #e2e8f0; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .inline-block { display: inline-block; }
            </style>
          </head>
          <body>
            ${element.outerHTML}
          </body>
        </html>
      `);
      iframeDoc.close();

      // Give a tiny window for render compilation
      await new Promise((resolve) => setTimeout(resolve, 300));

      const clonedElement = iframeDoc.getElementById(`payslip-${row.id}`);
      if (!clonedElement) {
        toast.error('Failed to clone element inside isolation frame');
        document.body.removeChild(iframe);
        return;
      }

      // Capture off-screen high-DPI canvas
      const canvas = await html2canvas(clonedElement, {
        scale: 2, // 2x resolution for high-fidelity text rendering
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 size width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      const empName = row.user?.name || row.name || 'Employee';
      const monthName = new Date(0, month - 1).toLocaleString('default', { month: 'long' });
      pdf.save(`${empName.replace(/\s+/g, '_')}_SalarySlip_${monthName}_${year}.pdf`);
      toast.success(`PDF payslip downloaded for ${empName}`);
      
      // Cleanup the temporary iframe sandbox
      document.body.removeChild(iframe);
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      toast.error('Failed to generate PDF salary slip');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Payroll Management</h1>
        <p className="text-slate-550 dark:text-gray-400 mt-1">Calculate and generate monthly salary slips.</p>
      </div>
 
      {/* Generation Card */}
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col md:flex-row items-end gap-6">
          <div className="flex-1 w-full space-y-2">
            <label className="text-sm font-semibold text-slate-650 dark:text-gray-400 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Select Month
            </label>
            <select 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none font-semibold"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full space-y-2">
            <label className="text-sm font-semibold text-slate-650 dark:text-gray-400">Select Year</label>
            <input 
              type="number" 
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold"
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
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Salary Summary (Generated)</h2>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-black/40 text-slate-800 dark:text-gray-300 text-sm uppercase tracking-wider border-b border-slate-200 dark:border-white/10 font-bold">
                  <th className="px-6 py-4 font-bold">Employee</th>
                  <th className="px-6 py-4 font-bold">Attendance</th>
                  <th className="px-6 py-4 font-bold">Base Salary</th>
                  <th className="px-6 py-4 font-bold text-emerald-600 dark:text-green-400">Gross Salary</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {payrollResults.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-white font-bold">{row.user?.name || row.name || 'N/A'}</span>
                        <span className="text-slate-500 dark:text-gray-500 text-xs font-semibold">ID: {row.employeeId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.presentDays}P</span>
                        <span className="text-slate-300 dark:text-gray-600">/</span>
                        <span className="text-red-500 dark:text-red-400">{row.absentDays}A</span>
                        <span className="text-slate-400 dark:text-gray-500 text-xs ml-2">({row.totalDays} days)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-gray-200 font-semibold">৳{row.baseSalary?.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-green-400">৳{row.grossSalary?.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 flex items-center w-fit gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDownloadPDF(row)}
                        disabled={downloadingId === row.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingId === row.id ? (
                          <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current"></span>
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Slip PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {/* Hidden Payslip Templates for PDF Capture (Rendered off-screen with absolute values) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {payrollResults.map((row) => (
          <SalarySlipPDF 
            key={row.id} 
            payroll={row} 
            monthName={new Date(0, month - 1).toLocaleString('default', { month: 'long' })} 
          />
        ))}
      </div>
    </div>
  );
}
