'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Megaphone, Search, Send, Loader2 } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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
                  <option value="SOFTWARE_AND_WEB_DEV">Software & Web Dev</option>
                  <option value="SEO_AND_MARKETING">SEO & Marketing</option>
                  <option value="GRAPHICS_AND_DESIGN">Graphics & Design</option>
                  <option value="VIDEO_PRODUCTION">Video Production</option>
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
    </div>
  );
}
