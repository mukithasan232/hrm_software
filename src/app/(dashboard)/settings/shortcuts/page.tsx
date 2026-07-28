'use client';

import React, { useState, useEffect } from 'react';
import PageGuard from '@/components/auth/PageGuard';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Link as LinkIcon, Loader2, X, MoveUp, MoveDown, Lightbulb, Menu, Volume2, ArrowLeft } from 'lucide-react';

export default function ShortcutsSettingsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('Link');
  const [order, setOrder] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchApps = async () => {
    try {
      const res = await api.get('/connected-apps');
      setApps(res.data || []);
    } catch (err) {
      toast.error('Failed to load apps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return toast.error('Label and URL are required');
    
    setSubmitting(true);
    const appData = { name: label, url, iconUrl: icon };

    try {
      if (editingId) {
        await api.put(`/connected-apps/${editingId}`, appData);
        toast.success('App updated successfully');
      } else {
        await api.post('/connected-apps', appData);
        toast.success('App added successfully');
      }
      setShowModal(false);
      resetForm();
      fetchApps();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this app?")) return;
    try {
      await api.delete(`/connected-apps/${id}`);
      toast.success('App deleted');
      fetchApps();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const resetForm = () => {
    setLabel(''); setUrl(''); setIcon('Link'); setOrder(0); setEditingId(null);
  };

  const openEditModal = (app: any) => {
    setEditingId(app.id);
    setLabel(app.name);
    setUrl(app.url);
    setIcon(app.iconUrl || '');
    setShowModal(true);
  };

  return (
    <PageGuard moduleName="Settings">
      <div className="p-6 max-w-6xl mx-auto min-h-screen">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <LinkIcon className="w-8 h-8 text-indigo-500" />
              Connected Apps
            </h1>
            <p className="text-slate-500 dark:text-gray-400 mt-1">Manage external apps available in the top navigation bar</p>
          </div>
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition font-semibold"
          >
            <Plus className="w-5 h-5" /> Add App
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.length === 0 && (
              <div className="col-span-full p-4 md:p-6 lg:p-8 text-center text-slate-500 dark:text-gray-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
                No connected apps found. Click "Add App" to create one.
              </div>
            )}
            
            {apps.map(s => (
              <div key={s.id} className="relative group p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden">
                      {s.iconUrl ? <img src={s.iconUrl} alt="icon" className="w-full h-full object-cover" /> : <LinkIcon className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{s.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-gray-400 break-all">{s.url}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end items-center">
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(s)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editingId ? 'Edit Connected App' : 'Add New App'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-1">App Name <span className="text-red-500">*</span></label>
                  <input required value={label} onChange={e => setLabel(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50" placeholder="e.g., CRM App" />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-1">Target URL <span className="text-red-500">*</span></label>
                  <input required value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50" placeholder="https://..." />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-1">Icon URL</label>
                  <input value={icon} onChange={e => setIcon(e.target.value)} className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50" placeholder="https://..." />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-semibold transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition disabled:opacity-50">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editingId ? 'Update' : 'Save App'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageGuard>
  );
}
