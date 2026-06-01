'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Camera, Save, Lock, User, Briefcase, Mail, Building, Printer } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useBrand } from '@/context/BrandContext';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND = 'http://localhost:5001';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { brand } = useBrand();
  const fileRef = useRef<HTMLInputElement>(null);



  const [form, setForm] = useState({ name: '', designation: '', department: '', phone: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        designation: (user as any).designation || '',
        department: (user as any).department || '',
        phone: (user as any).phone || '',
      });
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await api.put('/users/profile/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser({
        name: res.data.user.name,
        profileImage: res.data.user.profileImage,
        designation: res.data.user.designation,
        department: res.data.user.department,
      });

      toast.success('Profile updated successfully!');
      setAvatarFile(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error('New passwords do not match!');
    }
    if (passwords.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setChangingPw(true);
    try {
      await api.put('/users/profile/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password changed successfully!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const avatarSrc = preview || (user?.profileImage ? `${BACKEND}${user.profileImage}` : null);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="print-hide">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-slate-550 dark:text-gray-400 mt-1 text-sm font-medium">Manage your personal information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="print-hide bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-sm dark:shadow-2xl">
            <div className="relative inline-block">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Profile"
                  className="h-28 w-28 rounded-full object-cover border-4 border-slate-200 dark:border-white/10 shadow-2xl mx-auto"
                />
              ) : (
                <div className="h-28 w-28 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-slate-200 dark:border-white/10 shadow-2xl mx-auto bg-gradient-to-tr from-brand-primary to-brand-secondary">
            {initials}
          </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full border-2 border-white dark:border-slate-900 transition-colors shadow-md text-white bg-brand-primary"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div>
              <p className="text-slate-900 dark:text-white font-bold text-lg">{user?.name}</p>
              <p className="text-slate-550 dark:text-gray-400 text-sm font-semibold">{user?.designation}</p>
              <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold border bg-brand-primary/10 text-brand-primary border-brand-primary/30">
                {user?.designation}
              </span>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10 space-y-2 text-left">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 font-semibold">
                <Mail className="w-4 h-4 text-slate-400 dark:text-gray-500 flex-shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400 font-semibold">
                <Building className="w-4 h-4 text-slate-400 dark:text-gray-500 flex-shrink-0" />
                <span className="truncate">{(user as any)?.department || 'Not set'}</span>
              </div>
            </div>

            {preview && (
              <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg p-2 font-semibold">
                New photo selected. Save profile to apply.
              </p>
            )}
          </div>

          {/* Virtual ID Card */}
          <div className="print-hide bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Virtual ID Card</h2>
              <button onClick={() => window.print()} className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg font-semibold transition-colors flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
            
            <div className="print-only-id-card relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-2xl p-6 text-center text-white isolate">
              {/* Glassmorphism background effects */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/30 blur-2xl -z-10" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-purple-500/30 blur-2xl -z-10" />
              
              <div className="mb-4 font-black text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase">
                FIXANYPHOTO
              </div>
              
              <div className="mb-4">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" className="h-24 w-24 rounded-full object-cover border-4 border-white/20 mx-auto shadow-lg" />
                ) : (
                  <div className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold border-4 border-white/20 shadow-lg mx-auto bg-gradient-to-tr from-indigo-500 to-purple-500">
                    {initials}
                  </div>
                )}
              </div>
              
              <h3 className="font-bold text-xl mb-1">{user?.name}</h3>
              <p className="text-blue-300 font-semibold text-xs mb-5">{user?.designation || 'Employee'}</p>
              
              <div className="bg-white rounded-xl p-2.5 shadow-inner inline-block mb-3">
                <QRCodeSVG value={(user as any)?.employeeId || 'EMP-UNKNOWN'} size={70} />
              </div>
              
              <div className="text-xs font-mono text-slate-300 tracking-widest bg-black/20 py-1.5 rounded-lg border border-white/10">
                {(user as any)?.employeeId || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Forms */}
        <div className="print-hide lg:col-span-2 space-y-6">
          {/* Personal Info Form */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-blue-550 dark:text-blue-400" /> Personal Information
            </h2>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Designation</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={e => setForm({ ...form, designation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-primary/40 cursor-pointer hover:opacity-90 bg-brand-primary"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Password Form */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Lock className="w-5 h-5 text-purple-550 dark:text-purple-400" /> Change Password
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwords.currentPassword}
                  onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 transition-all font-semibold"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">New Password</label>
                  <input
                    type="password"
                    required
                    value={passwords.newPassword}
                    onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 dark:text-gray-400 font-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passwords.confirmPassword}
                    onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-850 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/25 transition-all font-semibold"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={changingPw}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-brand-secondary/40 hover:opacity-90 bg-brand-secondary"
                >
                  <Lock className="w-4 h-4" />
                  {changingPw ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
