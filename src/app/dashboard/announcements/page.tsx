'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Megaphone, Search, Send, Loader2, Mailbox, Clock, Building2, User } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'INBOX' | 'BROADCAST'>('INBOX');
  const [inboxNotices, setInboxNotices] = useState<any[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  const isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'].includes(
    (user as any)?.designation || ''
  );

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetType: 'GLOBAL',
    targetDepartment: '',
    targetUserId: ''
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users');
        const empList = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setEmployees(empList);
      } catch (error) {
        console.error('Failed to fetch employees', error);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/team/departments');
        const deptList = Array.isArray(res.data) ? res.data : (res.data.data || res.data.departments || []);
        setDepartments(deptList);
      } catch (error) {
        console.error('Failed to fetch departments', error);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (activeTab === 'INBOX') {
      fetchInbox();
    }
  }, [activeTab]);

  const fetchInbox = async () => {
    setLoadingInbox(true);
    try {
      const res = await api.get('/announcements');
      setInboxNotices(res.data);
    } catch (e) {
      toast.error('Failed to load announcements');
    } finally {
      setLoadingInbox(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      toast.error('Title and message are required');
      return;
    }
    if (formData.targetType === 'DEPARTMENT' && !formData.targetDepartment) {
      toast.error('Please select a department');
      return;
    }
    if (formData.targetType === 'INDIVIDUAL' && !formData.targetUserId) {
      toast.error('Please select an employee');
      return;
    }

    setLoading(true);
    try {
      await api.post('/announcements', formData);
      toast.success('Announcement sent successfully!');
      setFormData({
        title: '',
        message: '',
        targetType: 'GLOBAL',
        targetDepartment: '',
        targetUserId: ''
      });
      setSearchTerm('');
    } catch (error: any) {
      const errData = error.response?.data;
      toast.error(errData?.details || errData?.error || errData?.message || 'Failed to send announcement');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
          <Megaphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Broadcast Announcement</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Send enterprise-wide notices or target specific teams/individuals.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-white/10 pb-px mb-6">
          <button
            onClick={() => setActiveTab('INBOX')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'INBOX' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Mailbox className="w-4 h-4" /> My Notices
          </button>
          <button
            onClick={() => setActiveTab('BROADCAST')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'BROADCAST' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Send className="w-4 h-4" /> Broadcast
          </button>
        </div>
      )}

      {activeTab === 'INBOX' && (
        <div className="space-y-4">
          {loadingInbox ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : inboxNotices.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-12 text-center shadow-sm">
              <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-white">No Announcements</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1">You're all caught up. There are no notices for you or your department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {inboxNotices.map((notice: any) => (
                <div key={notice.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {notice.targetType === 'GLOBAL' && <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">Global</span>}
                        {notice.targetType === 'DEPARTMENT' && <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Building2 className="w-3 h-3" /> Dept</span>}
                        {notice.targetType === 'INDIVIDUAL' && <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><User className="w-3 h-3" /> Direct</span>}
                        
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                          <Clock className="w-3 h-3" />
                          {new Date(notice.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{notice.title}</h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap">{notice.message}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-white">
                      {notice.author?.name?.charAt(0) || 'A'}
                    </div>
                    Sent by {notice.author?.name || 'System Admin'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'BROADCAST' && isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm dark:shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300">Announcement Title</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Office closed for National Holiday"
              className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300">Message Content</label>
            <textarea 
              required
              rows={5}
              value={formData.message}
              onChange={e => setFormData({...formData, message: e.target.value})}
              placeholder="Write your announcement details here..."
              className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300">Send To</label>
              <select 
                value={formData.targetType}
                onChange={e => setFormData({...formData, targetType: e.target.value, targetDepartment: '', targetUserId: ''})}
                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="GLOBAL">Global (All Employees)</option>
                <option value="DEPARTMENT">Specific Department</option>
                <option value="INDIVIDUAL">Specific Individual</option>
              </select>
            </div>

            {formData.targetType === 'DEPARTMENT' && (
              <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300">Select Department</label>
                <select 
                  required
                  value={formData.targetDepartment}
                  onChange={e => setFormData({...formData, targetDepartment: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select a department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.targetType === 'INDIVIDUAL' && (
              <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300">Search Individual Employee</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search name or ID..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (formData.targetUserId) setFormData({...formData, targetUserId: ''});
                    }}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {searchTerm && !formData.targetUserId && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 text-center">No employees found</div>
                      ) : (
                        filteredEmployees.map(emp => (
                          <div 
                            key={emp.id}
                            onClick={() => {
                              setFormData({...formData, targetUserId: emp.id});
                              setSearchTerm(`${emp.name} (${emp.employeeId})`);
                            }}
                            className="p-3 text-sm text-slate-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0"
                          >
                            <span className="font-semibold">{emp.name}</span>
                            <span className="text-slate-400 ml-2">ID: {emp.employeeId}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {loading ? 'Sending Announcement...' : 'Broadcast Notice'}
            </button>
          </div>

        </form>
      </div>
      )}
    </div>
  );
}
