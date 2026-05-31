'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Search, Building2, User, Mail, UploadCloud, X, RefreshCw, Key } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

const BACKEND = 'http://localhost:5001';

type EmployeeType = 'REMOTE' | 'IN_HOUSE';

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  designation?: { name: string };
  employeeType: EmployeeType;
  department?: string;
  profileImage?: string;
  isActive: boolean;
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const canEdit = ['Admin', 'Super Admin', 'HR Manager'].includes((user as any)?.designation || '');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formType, setFormType] = useState<EmployeeType>('IN_HOUSE');

  // File State
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [nidFile, setNidFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const [empRes, desRes] = await Promise.all([
        fetch('/api/employees').then(res => res.json()),
        api.get('/team/designations').then(res => res.data).catch(() => []),
      ]);
      if (Array.isArray(empRes)) {
        setEmployees(empRes);
      }
      if (Array.isArray(desRes)) {
        setDesignations(desRes);
      }
    } catch (e) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formPassword || !formDesignation) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', formName);
      formData.append('email', formEmail);
      formData.append('password', formPassword);
      formData.append('designationId', formDesignation);
      formData.append('employeeType', formType);

      if (cvFile) formData.append('cv', cvFile);
      if (nidFile) formData.append('nid', nidFile);
      if (certFile) formData.append('certificates', certFile);

      const res = await fetch('/api/employees', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Failed to add employee');
      
      toast.success('Employee added & email sent!');
      setShowModal(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPassword(''); setFormDesignation('');
    setFormType('IN_HOUSE'); setCvFile(null); setNidFile(null); setCertFile(null);
  };

  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Employee Directory</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm font-medium">Manage organization members</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search directory..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/50 text-slate-800 dark:text-white transition-all font-medium"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded-xl hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/25"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <User className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">No employees found</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 text-sm">Add your first employee to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between">
                {emp.profileImage ? (
                  <img src={`${BACKEND}${emp.profileImage}`} alt={emp.name} className="h-12 w-12 rounded-full object-cover border-2 border-slate-100 dark:border-white/10" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold text-base shadow-inner">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-black/30 text-[10px] uppercase tracking-wider rounded-lg text-slate-500 dark:text-gray-400 font-bold border border-slate-200 dark:border-white/5">
                  {emp.employeeId}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate">{emp.name}</h3>
                <p className="text-xs font-semibold text-brand-primary mt-1">{emp.designation?.name || 'Employee'}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${emp.employeeType === 'REMOTE' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                  {emp.employeeType}
                </span>
                <div className="flex gap-2">
                  <a href={`mailto:${emp.email}`} className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-brand-primary transition-colors border border-slate-100 dark:border-white/5">
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Add New Employee</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Full Name *</label>
                  <input required type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Email Address *</label>
                  <input required type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Designation *</label>
                  <select required value={formDesignation} onChange={e => setFormDesignation(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary/50">
                    <option value="">Select Designation</option>
                    {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Employee Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as EmployeeType)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary/50">
                    <option value="IN_HOUSE">In-House</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>
                
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Password *</label>
                  <div className="flex gap-2">
                    <input required type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary/50" />
                    <button type="button" onClick={generatePassword} className="px-4 py-2.5 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-white/20 transition-colors flex items-center gap-2">
                      <Key className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><UploadCloud className="w-4 h-4 text-brand-primary" /> Onboarding Documents (PDFs)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative">
                    <input type="file" accept=".pdf" onChange={e => setCvFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <span className="text-xs font-bold text-slate-500 dark:text-gray-400 block mb-1">CV / Resume</span>
                    <span className="text-[10px] font-medium text-brand-primary block truncate">{cvFile ? cvFile.name : 'Click to attach'}</span>
                  </div>
                  <div className="border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative">
                    <input type="file" accept=".pdf" onChange={e => setNidFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <span className="text-xs font-bold text-slate-500 dark:text-gray-400 block mb-1">NID / Passport</span>
                    <span className="text-[10px] font-medium text-brand-primary block truncate">{nidFile ? nidFile.name : 'Click to attach'}</span>
                  </div>
                  <div className="border-2 border-dashed border-slate-200 dark:border-white/20 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative">
                    <input type="file" accept=".pdf" onChange={e => setCertFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <span className="text-xs font-bold text-slate-500 dark:text-gray-400 block mb-1">Certificates</span>
                    <span className="text-[10px] font-medium text-brand-primary block truncate">{certFile ? certFile.name : 'Click to attach'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/30 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Creating Employee...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
