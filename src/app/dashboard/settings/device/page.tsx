'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Save, Server, Shield, Network } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

export default function DeviceSettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState({
    name: 'Main Gate',
    ipAddress: '',
    port: '4370',
    commKey: '0'
  });

  useEffect(() => {
    fetchDevice();
  }, []);

  const fetchDevice = async () => {
    try {
      const res = await api.get('/settings/device');
      if (res.data && res.data.ipAddress) {
        setDevice({
          name: res.data.name || 'Main Gate',
          ipAddress: res.data.ipAddress,
          port: res.data.port?.toString() || '4370',
          commKey: res.data.commKey?.toString() || '0'
        });
      }
    } catch (e) {
      console.error('Failed to fetch device', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/settings/device', device);
      toast.success('Device settings saved successfully!');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save device settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Loading settings...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 text-indigo-500 rounded-xl">
          <Server className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Device Settings</h1>
      </div>

      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
        <p className="text-slate-600 dark:text-gray-400 mb-6">
          Configure the active ZKTeco biometric device connection for the Multi-Tenant SaaS platform.
        </p>

        <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300">Device Name</label>
              <input 
                type="text" 
                required 
                value={device.name}
                onChange={e => setDevice({...device, name: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500" 
                placeholder="e.g. Main Gate" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <Network className="w-4 h-4 text-indigo-500" /> IP Address
              </label>
              <input 
                type="text" 
                required 
                value={device.ipAddress}
                onChange={e => setDevice({...device, ipAddress: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500" 
                placeholder="192.168.1.201" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <Network className="w-4 h-4 text-emerald-500" /> Port
              </label>
              <input 
                type="number" 
                required 
                value={device.port}
                onChange={e => setDevice({...device, port: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500" 
                placeholder="4370" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" /> Communication Key
              </label>
              <input 
                type="number" 
                value={device.commKey}
                onChange={e => setDevice({...device, commKey: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500" 
                placeholder="0" 
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-white/10">
            <button 
              type="submit" 
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
