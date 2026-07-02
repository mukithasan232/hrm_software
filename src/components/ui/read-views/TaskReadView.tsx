import React from 'react';
import { Calendar, User, Clock, Paperclip, CheckCircle2, AlertCircle, MessageSquare, Send, Activity, Info, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';

export default function TaskReadView({ id, initialData }: { id: string | number | null, initialData: any }) {
  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-sm text-slate-500 animate-pulse">Fetching task data...</p>
      </div>
    );
  }

  const task = initialData;
  const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

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
        {task.outputImages && Array.isArray(task.outputImages) && task.outputImages.length > 0 && (
          <div className="pt-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-400" />
              Attachments ({task.outputImages.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {task.outputImages.map((imgUrl: string, idx: number) => {
                const fullUrl = `${BACKEND}${imgUrl}`;
                return (
                  <a
                    key={idx}
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
                  >
                    <img
                      src={fullUrl}
                      alt={`Attachment ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <hr className="border-slate-200 dark:border-white/10" />

        {/* Stream / Comments Section */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Stream
          </h3>

          <div className="flex gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
              ME
            </div>
            <div className="flex-1 relative">
              <textarea
                rows={3}
                placeholder="Write your comment here..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              <button className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Dummy Activity Item 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                <Info className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 pt-1.5">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">Admin</span> created this task
                </p>
                <span className="text-xs text-slate-400">Oct 2, 2023, 10:45 AM</span>
              </div>
            </div>

            {/* Dummy Activity Item 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                <MessageSquare className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">System Administrator</p>
                  <span className="text-xs text-slate-400">Oct 2, 2023, 11:30 AM</span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                  Updated status to <span className="font-bold">In Progress</span>. We will start working on this immediately.
                </div>
              </div>
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
