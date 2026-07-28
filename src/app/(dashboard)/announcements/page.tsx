'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Megaphone, Search, Send, Loader2, Mailbox, Clock, Building2, User, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import dynamic from 'next/dynamic';
// @ts-ignore - types are currently unavailable for react-quill
import 'react-quill-new/dist/quill.snow.css';

// @ts-ignore - types are currently unavailable for react-quill
const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false, 
  loading: () => <div className="h-40 w-full animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" /> 
});

const modules = {
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{'list': 'ordered'}, {'list': 'bullet'}],
    ['link'],
    ['clean']
  ],
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'INBOX' | 'BROADCAST'>('INBOX');
  const [inboxNotices, setInboxNotices] = useState<any[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [editorMode, setEditorMode] = useState<'VISUAL' | 'CODE'>('VISUAL');

  // Combobox state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxSearch, setComboboxSearch] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  const { can } = usePermissions();
  const isAdmin = can('Announcements', 'canCreate');

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
    if (activeTab === 'INBOX') fetchInbox();
  }, [activeTab]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
    // React-Quill uses '<p><br></p>' for empty text, so we check for meaningful content
    const plainText = formData.message.replace(/(<([^>]+)>)/gi, "").trim();
    
    if (!formData.title || !plainText) {
      toast.error('Title and message content are required');
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
      setComboboxSearch('');
    } catch (error: any) {
      const errData = error.response?.data;
      toast.error(errData?.details || errData?.error || errData?.message || 'Failed to send announcement');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(comboboxSearch.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(comboboxSearch.toLowerCase()) ||
    (emp.designation || '').toLowerCase().includes(comboboxSearch.toLowerCase())
  );

  const selectedEmployee = employees.find(e => e.id === formData.targetUserId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 flex-shrink-0">
          <Megaphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Broadcast Announcement</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1 font-medium">Send enterprise-wide notices or target specific teams/individuals.</p>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Inbox Tab */}
      {activeTab === 'INBOX' && (
        <div className="space-y-4 max-w-4xl">
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
                      {/* Render HTML for received notices */}
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300"
                        dangerouslySetInnerHTML={{ __html: notice.message }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-white">
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

      {/* Broadcast Form Tab */}
      {activeTab === 'BROADCAST' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Left Column: Form */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-black/20">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" /> Create Notice
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Announcement Title *</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. Important System Update"
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Target Audience *</label>
                <div className="relative">
                  <select 
                    value={formData.targetType}
                    onChange={e => setFormData({...formData, targetType: e.target.value, targetDepartment: '', targetUserId: ''})}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none font-medium cursor-pointer"
                  >
                    <option value="GLOBAL">Global (All Employees)</option>
                    <option value="DEPARTMENT">Specific Department</option>
                    <option value="INDIVIDUAL">Specific Individual</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {formData.targetType === 'DEPARTMENT' && (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Select Department *</label>
                  <div className="relative">
                    <select 
                      required
                      value={formData.targetDepartment}
                      onChange={e => setFormData({...formData, targetDepartment: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none font-medium cursor-pointer"
                    >
                      <option value="">Select a department...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Smart Combobox */}
              {formData.targetType === 'INDIVIDUAL' && (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200" ref={comboboxRef}>
                  <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Select Employee *</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setComboboxOpen(!comboboxOpen)}
                      className={`w-full flex items-center justify-between bg-slate-50 dark:bg-black/40 border ${comboboxOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'} rounded-xl px-4 py-3 text-left focus:outline-none transition-all`}
                    >
                      {selectedEmployee ? (
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                            {selectedEmployee.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">{selectedEmployee.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium text-sm">Select an employee...</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${comboboxOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {comboboxOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-2 border-b border-slate-100 dark:border-white/10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text" 
                              autoFocus
                              placeholder="Search name, ID, or designation..."
                              value={comboboxSearch}
                              onChange={(e) => setComboboxSearch(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900/50 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1">
                          {filteredEmployees.length === 0 ? (
                            <div className="p-4 text-center text-sm text-slate-500">No employees found.</div>
                          ) : (
                            filteredEmployees.map(emp => (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, targetUserId: emp.id});
                                  setComboboxOpen(false);
                                  setComboboxSearch('');
                                }}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${formData.targetUserId === emp.id ? 'bg-indigo-50 dark:bg-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold flex-shrink-0">
                                  {emp.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{emp.name}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {emp.designation || 'Employee'} • ID: {emp.employeeId}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Message Content *</label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEditorMode('VISUAL')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${editorMode === 'VISUAL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('CODE')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${editorMode === 'CODE' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                      Code (HTML/JS)
                    </button>
                  </div>
                </div>
                
                {editorMode === 'VISUAL' ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 [&_.ql-toolbar]:border-none [&_.ql-toolbar]:bg-slate-50 [&_.ql-toolbar]:dark:bg-white/5 [&_.ql-toolbar]:border-b [&_.ql-container]:border-none [&_.ql-editor]:min-h-[200px] [&_.ql-editor]:text-slate-700 [&_.ql-editor]:dark:text-slate-300 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                    {(() => {
                      const Editor = ReactQuill as any;
                      return (
                        <Editor 
                          theme="snow"
                          value={formData.message}
                          onChange={(val: string) => setFormData({...formData, message: val})}
                          modules={modules}
                          placeholder="Write your beautiful notice here..."
                        />
                      );
                    })()}
                  </div>
                ) : (
                  <div className="bg-slate-900 dark:bg-black/60 rounded-xl overflow-hidden border border-slate-800 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
                    <div className="bg-slate-800 dark:bg-white/5 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">index.html</span>
                    </div>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      placeholder="<!-- Paste your raw HTML, inline CSS, or JS scripts here... -->&#10;<style>&#10;  .highlight { color: red; }&#10;</style>&#10;<div class='highlight'>Hello World</div>"
                      className="w-full min-h-[240px] p-4 bg-transparent text-sm font-mono text-emerald-400 focus:outline-none resize-y placeholder:text-slate-600"
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {loading ? 'Sending Announcement...' : 'Broadcast Notice Now'}
              </button>
            </form>
          </div>

          {/* Right Column: Live Preview Card */}
          <div className="lg:sticky lg:top-6 space-y-4 animate-in fade-in slide-in-from-right-4 duration-700">
            <h3 className="text-sm font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Live Preview
            </h3>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              {/* Decorative gradient corner */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  {/* Mock Target Badge */}
                  {formData.targetType === 'GLOBAL' && <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">Global Notice</span>}
                  {formData.targetType === 'DEPARTMENT' && <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider">Department</span>}
                  {formData.targetType === 'INDIVIDUAL' && <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Direct Message</span>}
                  
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold ml-auto">
                    <Clock className="w-3 h-3" />
                    Just now
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 break-words">
                  {formData.title || <span className="text-slate-300 dark:text-slate-600">Your Title Goes Here...</span>}
                </h3>
                
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 border-l-2 border-indigo-500/30 pl-4 py-1">
                  {formData.message && formData.message !== '<p><br></p>' ? (
                    <div dangerouslySetInnerHTML={{ __html: formData.message }} />
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic">Notice content will appear here...</p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                    {(user as any)?.name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white">{(user as any)?.name || 'System Administrator'}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Notice Sender</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-center text-slate-400 font-medium pt-2">This is exactly how recipients will see your announcement.</p>
          </div>
        </div>
      )}
    </div>
  );
}
