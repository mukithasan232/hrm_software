import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, User, Clock, Paperclip, CheckCircle2, AlertCircle, MessageSquare, Send, Activity, Info, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

export default function TaskReadView({ id, initialData }: { id: string | number | null, initialData: any }) {
  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-sm text-slate-500 animate-pulse">Fetching task data...</p>
      </div>
    );
  }

  const [task, setTask] = useState<any>(initialData);

  useEffect(() => {
    setTask(initialData);
  }, [initialData]);

  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';
  const [imageError, setImageError] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>(initialData?.taskComments || []);
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/tasks/${task?.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (error) {
        console.error("Failed to fetch comments", error);
      }
    };
    if (task?.id) fetchComments();
  }, [task?.id]);

  const handleSendMessage = async () => {
    if (!comment.trim() || isSending) return;
    setIsSending(true);
    
    try {
      const res = await fetch(`/api/tasks/${task?.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment, userId: (currentUser as any)?.id })
      });
      
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setComment("");
      } else {
        console.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Helpers for Badges
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20';
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 dark:hover:bg-blue-500/20';
      case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 dark:hover:bg-amber-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:hover:bg-red-500/20';
      case 'HIGH': return 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20 dark:hover:bg-orange-500/20';
      case 'NORMAL': return 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:hover:bg-indigo-500/20';
      case 'LOW': return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700';
      default: return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
      {/* LEFT COLUMN: Main Content & Stream */}
      <div className="lg:col-span-2 space-y-8">

        {/* Title and Meta Row */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight mb-4">
            {task.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <button className={`px-4 py-1.5 text-xs font-bold rounded-md border uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${getStatusColor(task.status)}`}>
              {task.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {task.status?.replace('_', ' ')}
            </button>
            <button className={`px-4 py-1.5 text-xs font-bold rounded-md border uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${getPriorityColor(task.priority)}`}>
              <AlertCircle className="w-4 h-4" />
              {task.priority} Priority
            </button>
          </div>
        </div>

        {/* Description Section */}
        {task.description && (
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">Description</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-loose">
              {task.description}
            </p>
          </div>
        )}

        {/* Attachments Section */}
        {task?.attachment ? (
          <div className="mt-4 animate-in fade-in duration-300">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-400" />
              Attachment
            </h3>
            <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 w-full max-w-md shadow-sm">
              {!imageError ? (
                <img
                  src={`${BACKEND}${task.attachment}`}
                  alt="Task Attachment"
                  className="w-full max-h-[300px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onError={() => setImageError(true)}
                  onClick={() => window.open(`${BACKEND}${task.attachment}`, '_blank')}
                  title="Click to view full image"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 rounded-lg">
                  <p className="text-sm text-slate-500 mb-3 text-center">Attachment file</p>
                  <a
                    href={`${BACKEND}${task.attachment}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:text-blue-700 hover:bg-blue-100 transition-colors rounded-lg font-semibold text-sm w-full"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Attachment
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic mt-2">No attachment provided.</p>
        )}

        {/* Final Output Files Section */}
        {task.outputFiles && Array.isArray(task.outputFiles) && task.outputFiles.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Submitted Output</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {task.outputFiles.map((fileObj: any, idx: number) => {
                const url = typeof fileObj === 'string' ? fileObj : fileObj.url;
                const name = typeof fileObj === 'string' ? `Output ${idx + 1}` : fileObj.name;
                const fullUrl = url.startsWith('http') ? url : `${BACKEND}${url}`;
                const isImage = String(url).match(/\.(jpeg|jpg|gif|png)$/i);
                
                return (
                  <a key={idx} href={fullUrl} target="_blank" rel="noopener noreferrer" className="group relative block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500 transition-colors shadow-sm bg-white dark:bg-slate-800">
                    {isImage ? (
                      <img src={fullUrl} alt="Output" className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300 bg-slate-50 dark:bg-slate-900" />
                    ) : (
                      <div className="w-full h-24 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
                        <Paperclip className="w-6 h-6 text-indigo-400 mb-1" />
                        <span className="text-[10px] text-slate-500 truncate w-full px-2 text-center">{name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-xs font-semibold text-white">View Full</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <hr className="border-slate-200 dark:border-white/10" />

        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h3 className="text-sm font-bold text-slate-700 tracking-wider uppercase">Stream</h3>
          </div>

          {/* Display Existing Messages */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
            {comments && comments.length > 0 ? (
              comments.map((msg: any, idx: number) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-600 overflow-hidden">
                    {msg.user?.profileImage ? (
                      <img src={`${BACKEND}${msg.user.profileImage}`} alt={msg.user.name} className="w-full h-full object-cover" />
                    ) : (
                      msg.user?.name ? msg.user.name.substring(0, 2).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl rounded-tl-none w-full shadow-sm">
                    <p className="text-sm text-slate-700">{msg.text}</p>
                    <span className="text-[10px] text-slate-400 mt-2 block">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">No messages yet. Start the conversation!</p>
            )}
          </div>

          {/* Chat Input Box */}
          <div className="flex gap-3 items-end">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-blue-700">
              ME
            </div>
            <div className="relative flex-1 border border-slate-300 rounded-xl bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Write your comment here..."
                className="w-full bg-transparent p-3 pr-12 outline-none text-sm text-slate-700 min-h-[50px] resize-none rounded-xl"
                rows={2}
                disabled={isSending}
              />
              <button 
                onClick={handleSendMessage}
                disabled={isSending || !comment.trim()}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                  comment.trim() && !isSending 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSending ? (
                   <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                   </svg>
                ) : (
                  <svg className="w-4 h-4 transform rotate-45 -mt-1 -ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Assignee & Timeline */}
      <div className="lg:col-span-1 space-y-6">

        {/* Assigned User Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Assignee</p>
          <div className="flex items-center gap-3">
            {task.assignedUser?.profileImage ? (
              <img src={`${BACKEND}${task.assignedUser.profileImage}`} alt={task.assignedUser.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                {task.assignedUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {task.assignedUser?.name || 'Unassigned'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {task.assignedUser?.designation?.name || 'Team Member'}
              </p>
            </div>
          </div>
        </div>

        {/* Dates Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Dates</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium">Start Date</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {task.startDate ? format(new Date(task.startDate), 'MMM d, yyyy') : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Due Date</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : '—'}
            </span>
          </div>
        </div>

        {/* Timeline Details */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Details</p>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Created At</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy, h:mm a') : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last Updated</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {task.updatedAt ? format(new Date(task.updatedAt), 'MMM d, yyyy, h:mm a') : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
