'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Server, Loader2, Eye, EyeOff, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SystemSettingsPage() {
  const [adminConfig, setAdminConfig] = useState({ name: 'Super Admin', email: 'admin@fixanyphoto.com', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminConfig({ ...adminConfig, [e.target.name]: e.target.value });
  };

  const saveSystemConfig = async () => {
    if (adminConfig.password !== adminConfig.confirmPassword) {
      return toast.error('Passwords do not match.');
    }
    
    if (adminConfig.password && adminConfig.password.length < 6) {
      return toast.error('Password must be at least 6 characters long.');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/settings/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminConfig }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');

      toast.success(data.message || 'System settings saved!');
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl p-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Server className="w-8 h-8 text-slate-500" />
          System Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage master configurations and super admin.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-8 space-y-8">
        
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Super Admin Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Full Name" name="name" value={adminConfig.name} onChange={handleAdminChange} />
            <InputField label="Email Address" name="email" type="email" value={adminConfig.email} onChange={handleAdminChange} />
            <PasswordField label="New Password" name="password" value={adminConfig.password} onChange={handleAdminChange} placeholder="Leave blank to keep unchanged" />
            <PasswordField label="Confirm New Password" name="confirmPassword" value={adminConfig.confirmPassword} onChange={handleAdminChange} placeholder="Leave blank to keep unchanged" />
          </div>
        </div>
        
        <button type="button" onClick={saveSystemConfig} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-slate-800 dark:bg-slate-700 text-white py-3 rounded-lg font-semibold hover:bg-slate-700 dark:hover:bg-slate-600 transition-all disabled:opacity-70 mt-4">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save System Configuration
        </button>
      </div>
    </div>
  );
}

function InputField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.name} className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        id={props.name}
        {...props}
        className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-transparent rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
      />
    </div>
  );
}

function PasswordField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.name} className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="relative">
        <input
          id={props.name}
          {...props}
          type={show ? 'text' : 'password'}
          className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-transparent rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
