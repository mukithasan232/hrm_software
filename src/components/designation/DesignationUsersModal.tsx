'use client';

import React, { useEffect, useState } from 'react';
import { X, Trash2, Plus, Users, Loader2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  profileImage: string | null;
  designationId: string | null;
  designation: string | null;
}

interface DesignationUsersModalProps {
  designationId: string;
  designationName: string;
  onClose: () => void;
  onUpdate: () => void; // To refresh parent if needed
}

export default function DesignationUsersModal({
  designationId,
  designationName,
  onClose,
  onUpdate
}: DesignationUsersModalProps) {
  const [currentUsers, setCurrentUsers] = useState<User[]>([]);
  const [otherUsers, setOtherUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/team/designations/${designationId}/users`);
      if (res.data?.success) {
        setCurrentUsers(res.data.data.currentUsers || []);
        setOtherUsers(res.data.data.otherUsers || []);
      }
    } catch (error) {
      console.error('Failed to fetch designation users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (designationId) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designationId]);

  const handleAddUser = async () => {
    if (!selectedUserToAdd) return;
    
    setIsAdding(true);
    try {
      await api.post(`/team/designations/${designationId}/users`, { userId: selectedUserToAdd });
      toast.success('User added successfully');
      setSelectedUserToAdd('');
      fetchUsers();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add user');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    setRemovingId(userId);
    try {
      await api.delete(`/team/designations/${designationId}/users?userId=${userId}`);
      toast.success('User removed successfully');
      fetchUsers();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove user');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Users in Designation
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-semibold">{designationName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-hidden flex flex-col max-h-[60vh]">
          {/* Add User Section */}
          <div className="mb-6 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Add Employee to Designation
              </label>
              <select
                value={selectedUserToAdd}
                onChange={(e) => setSelectedUserToAdd(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">-- Select an active employee --</option>
                {otherUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.employeeId}) - Current: {user.designation || 'None'}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddUser}
              disabled={!selectedUserToAdd || isAdding || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-all h-[42px]"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>

          {/* Current Users List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-white/10 rounded-xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 space-y-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Loading users...</p>
              </div>
            ) : currentUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Users className="w-8 h-8 text-slate-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-400">No users currently hold this designation.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {currentUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar 
                        src={user.profileImage} 
                        name={user.name} 
                        className="w-9 h-9 rounded-full object-cover" 
                        fallbackClassName="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.employeeId} • {user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      disabled={removingId === user.id}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                      title="Remove from designation"
                    >
                      {removingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
