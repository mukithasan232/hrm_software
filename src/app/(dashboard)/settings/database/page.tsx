'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Database, CheckCircle, AlertTriangle, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DatabaseSettingsPage() {
  const [dbConfig, setDbConfig] = useState({ host: '127.0.0.1', port: '3306', user: 'root', password: '', name: 'hrm_db' });
  const [dbStatus, setDbStatus] = useState<'unknown' | 'testing' | 'success' | 'error'>('unknown');

  const handleDbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDbConfig({ ...dbConfig, [e.target.name]: e.target.value });
    setDbStatus('unknown');
  };

  const testDbConnection = async () => {
    setDbStatus('testing');
    try {
      const res = await fetch('/api/settings/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Connection failed');
      setDbStatus('success');
      toast.success(data.message || 'Connection successful!');
    } catch (err: any) {
      setDbStatus('error');
      toast.error(`Connection failed: ${err.message}`);
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
          <Database className="w-8 h-8 text-indigo-500" />
          Database Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage database connection and credentials.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="DB Host" name="host" value={dbConfig.host} onChange={handleDbChange} />
          <InputField label="DB Port" name="port" value={dbConfig.port} onChange={handleDbChange} />
          <InputField label="DB Username" name="user" value={dbConfig.user} onChange={handleDbChange} />
          <PasswordField label="DB Password" name="password" value={dbConfig.password} onChange={handleDbChange} />
        </div>
        <InputField label="DB Name" name="name" value={dbConfig.name} onChange={handleDbChange} />
        
        <button type="button" onClick={testDbConnection} disabled={dbStatus === 'testing'} className="w-full flex items-center justify-center gap-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 py-3 rounded-lg font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-all disabled:opacity-70 mt-4">
          {dbStatus === 'testing' && <Loader2 className="w-5 h-5 animate-spin" />}
          {dbStatus === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          {dbStatus === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
          Test Connection
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
