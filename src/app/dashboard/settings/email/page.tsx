'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail, Save, Loader2, Send,
  Server, User, Lock, Globe, CheckCircle2, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';

// ─── Shared input / label styles ─────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all';
const labelCls =
  'text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block';

// ─── Toggle Switch component ──────────────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-white">{label}</p>
        {hint && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-white/20'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/10 mb-5">
      <div className="p-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20">
        <Icon className="w-3.5 h-3.5 text-brand-primary" />
      </div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-white">{title}</h3>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmailSettingsPage() {
  const [activeTab, setActiveTab] = useState<'MAIN' | 'SMTP'>('SMTP');

  // ── SMTP state ──
  const [host,     setHost]     = useState('');
  const [port,     setPort]     = useState('587');
  const [security, setSecurity] = useState('STARTTLS');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // ── MAIN / sender state ──
  const [senderName,    setSenderName]    = useState('HRM Portal');
  const [senderEmail,   setSenderEmail]   = useState('');
  const [emailEnabled,  setEmailEnabled]  = useState(true);

  // ── UI state ──
  const [saving,    setSaving]    = useState(false);
  const [testing,   setTesting]   = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Hydrate all fields from the database on mount ──
  useEffect(() => {
    const fetchEmailSettings = async () => {
      try {
        const res = await api.get('/settings/email');
        const data = res.data;

        // SMTP fields
        if (data.host)     setHost(data.host);
        if (data.port)     setPort(String(data.port));
        if (data.security) setSecurity(data.security);
        if (data.username) setUsername(data.username);
        if (data.password) setPassword(data.password);

        // MAIN fields
        if (data.senderName  !== undefined) setSenderName(data.senderName  || '');
        if (data.senderEmail !== undefined) setSenderEmail(data.senderEmail || '');
        if (data.emailEnabled !== undefined) setEmailEnabled(Boolean(data.emailEnabled));
      } catch (err: any) {
        // 401/403 = not logged in or not admin — silently ignore on load
        const status = err?.response?.status;
        if (status !== 401 && status !== 403) {
          console.error('Failed to load email settings:', err);
        }
      } finally {
        setHydrating(false);
      }
    };

    fetchEmailSettings();
  }, []);

  // ── Save MAIN tab ──
  const handleSaveMain = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/settings/email', { senderName, senderEmail, emailEnabled });
      toast.success('Main email settings saved!');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save main settings.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Save SMTP tab ──
  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      await api.post('/settings/email', { host, port, security, username, password });
      toast.success('SMTP configuration saved successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save SMTP settings.';
      toast.error(msg, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  // ── Test SMTP connection ──
  const handleTest = async () => {
    if (!host || !port || !username || !password) {
      toast.error('Please fill in all SMTP fields before testing.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/email/test', { host, port, security, username, password });
      const msg = res.data?.message || 'SMTP connection successful!';
      setTestResult({ ok: true, msg });
      toast.success(msg);
    } catch (err: any) {
      // Axios wraps non-2xx as an error — pull the exact Nodemailer message from response body
      const data = err?.response?.data;
      const errMsg = data?.error || data?.raw || err?.message || 'SMTP connection failed.';
      setTestResult({ ok: false, msg: errMsg });
      toast.error(errMsg, { duration: 8000 });
    } finally {
      setTesting(false);
    }
  };

  // ── Loading skeleton ──
  if (hydrating) {
    return (
      <div className="space-y-6 max-w-4xl animate-pulse">
        <div className="h-10 w-64 bg-slate-100 dark:bg-white/10 rounded-xl" />
        <div className="h-96 bg-slate-100 dark:bg-white/5 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">

      {/* Page header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <Mail className="w-6 h-6 text-orange-500" />
          </div>
          Email Configuration
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
          Configure system sender identity and SMTP relay for outbound email delivery.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-2 pt-2 gap-1">
          {(['MAIN', 'SMTP'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all rounded-t-lg ${
                activeTab === tab
                  ? 'border-brand-primary text-brand-primary bg-white dark:bg-white/5'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'MAIN' ? '⚙️  Main Settings' : '📡  SMTP Settings'}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ── MAIN TAB ── */}
          {activeTab === 'MAIN' && (
            <form onSubmit={handleSaveMain} className="space-y-6">
              <SectionTitle icon={Globe} title="Email Delivery" />

              <ToggleSwitch
                checked={emailEnabled}
                onChange={setEmailEnabled}
                label="Global Email Delivery"
                hint="When disabled, the system will not send any outbound emails."
              />

              <SectionTitle icon={User} title="Sender Identity" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>System Sender Name</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. HRM Portal"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Displayed as the "From" name in all outgoing emails.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>System Sender Email</label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="e.g. no-reply@company.com"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Must match the authenticated SMTP username/domain.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Main Settings'}
                </button>
              </div>
            </form>
          )}

          {/* ── SMTP TAB ── */}
          {activeTab === 'SMTP' && (
            <form onSubmit={handleSaveSmtp} className="space-y-6">
              <SectionTitle icon={Server} title="SMTP Server" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    placeholder="587 or 465"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Security / Encryption *</label>
                  <select
                    value={security}
                    onChange={(e) => setSecurity(e.target.value)}
                    className={inputCls}
                  >
                    <option value="STARTTLS">STARTTLS (Port 587)</option>
                    <option value="SSL/TLS">SSL / TLS (Port 465)</option>
                    <option value="None">None (Port 25)</option>
                  </select>
                </div>
              </div>

              <SectionTitle icon={Lock} title="Authentication" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    placeholder="App password or SMTP secret"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Inline test result banner */}
              {testResult && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm font-medium ${
                  testResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
                }`}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  }
                  <span className="break-all">{testResult.msg}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? 'Testing…' : 'Test SMTP Connection'}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all flex items-center gap-2 ml-auto disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save SMTP Configuration'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
