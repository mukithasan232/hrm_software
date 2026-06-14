import os

with open("src/app/dashboard/settings/device/page.tsx", "r") as f:
    device_code = f.read()

with open("src/app/dashboard/settings/email/page.tsx", "r") as f:
    email_code = f.read()

# Extract Device component body
device_body = device_code[device_code.find("export default function DeviceSettingsPage() {") + len("export default function DeviceSettingsPage() {"):]
device_body = device_body[:device_body.rfind("}")]

# Extract Email component body
email_body = email_code[email_code.find("export default function EmailSettingsPage() {") + len("export default function EmailSettingsPage() {"):]
email_body = email_body[:email_body.rfind("}")]
email_top = email_code[:email_code.find("export default function EmailSettingsPage() {")]

# Remove use client and imports from email_top
email_top_lines = [l for l in email_top.split('\n') if not l.startswith("import ") and not l.startswith("'use client'")]
email_top = '\n'.join(email_top_lines)

out = """'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail, Save, Loader2, Send,
  Server, User, Lock, Globe, CheckCircle2, AlertCircle, Shield, Network, Plug
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useTranslation } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

""" + email_top + """

function DeviceTab() {
  const { t } = useTranslation();
""" + device_body + """
}

function EmailTab() {
""" + email_body + """
}

export default function IntegrationsPage() {
  const [mainTab, setMainTab] = useState<'ZKTECO' | 'EMAIL'>('ZKTECO');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const desig = typeof user.designation === 'object' ? (user.designation as any)?.name : user.designation;
      if (!['Admin', 'Super Admin', 'System Administrator'].includes(desig)) {
        router.push('/dashboard');
        toast.error('Unauthorized access');
      }
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Plug className="w-6 h-6 text-indigo-500" />
          </div>
          Integrations Hub
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
          Manage hardware integrations and third-party services.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
        <button
          onClick={() => setMainTab('ZKTECO')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            mainTab === 'ZKTECO' ? 'bg-brand-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          Device Setup (ZKTeco)
        </button>
        <button
          onClick={() => setMainTab('EMAIL')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            mainTab === 'EMAIL' ? 'bg-brand-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          Email Setup (SMTP)
        </button>
      </div>

      <div className="mt-4">
        {mainTab === 'ZKTECO' && <DeviceTab />}
        {mainTab === 'EMAIL' && <EmailTab />}
      </div>
    </div>
  );
}
"""

os.makedirs("src/app/dashboard/settings/integrations", exist_ok=True)
with open("src/app/dashboard/settings/integrations/page.tsx", "w") as f:
    f.write(out)
print("Done")
