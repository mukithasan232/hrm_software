'use client';

import React, { useState } from 'react';
import { Mail, Save, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmailSettingsPage() {
  const [activeTab, setActiveTab] = useState<'MAIN' | 'IMAP' | 'SMTP'>('SMTP');
  
  // SMTP State
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [security, setSecurity] = useState('STARTTLS');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Stub save logic
    setTimeout(() => {
      toast.success('SMTP settings saved successfully!');
      setSaving(false);
    }, 800);
  };

  const handleTest = async () => {
    if (!host || !port || !username || !password) {
      toast.error('Please fill in all SMTP fields before testing.');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, security, username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'SMTP Connection successful!');
      } else {
        toast.error(data.error || 'SMTP Connection failed.');
      }
    } catch (err) {
      toast.error('An error occurred while testing SMTP connection.');
    } finally {
      setTesting(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all";
  const labelCls = "text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <Mail className="w-6 h-6 text-orange-500" />
            </div>
            Email Configuration
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Set up your custom IMAP/SMTP configurations for enterprise mailing.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-2 pt-2">
          {['MAIN', 'IMAP', 'SMTP'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab} Settings
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'SMTP' ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>SMTP Host *</label>
                  <input
                    required
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. smtp.gmail.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>SMTP Port *</label>
                  <input
                    required
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="e.g. 587 or 465"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Security (Encryption) *</label>
                  <select
                    value={security}
                    onChange={(e) => setSecurity(e.target.value)}
                    className={inputCls}
                  >
                    <option value="STARTTLS">STARTTLS (Port 587)</option>
                    <option value="SSL/TLS">SSL/TLS (Port 465)</option>
                    <option value="None">None</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Auth Username *</label>
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. user@company.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Auth Password *</label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="App password or secret"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? 'Testing...' : 'Send Test Email'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all flex items-center gap-2 ml-auto disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          ) : (
            <div className="py-12 text-center text-slate-500 dark:text-gray-400 font-medium">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
              {activeTab} configuration is under construction.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
