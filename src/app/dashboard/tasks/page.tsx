'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DragDropContext, Droppable, Draggable, DropResult,
} from '@hello-pangea/dnd';
import {
  Plus, LayoutList, Columns3, Search, X, Loader2, Pencil, Trash2,
  CalendarDays, User as UserIcon, ChevronDown, Flag, AlertTriangle,
  CheckCircle2, Clock, Circle, Hourglass, Paperclip, CheckSquare, BarChart3
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import { checkPermission } from '@/utils/checkPermission';
import PageGuard from '@/components/auth/PageGuard';
import { useDetailsStore } from '@/store/useDetailsStore';
import Cookies from 'js-cookie';


const BACKEND = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
  : '';

// ─── Types ────────────────────────────────────────────────────────────────────
type TaskStatus   = 'TODO' | 'IN_PROGRESS' | 'PENDING' | 'COMPLETED';
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface AssignedUser {
  id: string;
  name: string;
  profileImage?: string;
  employeeId: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: string;
  assignedTo: AssignedUser;
  createdById: string;
  createdBy: { id: string; name: string };
  attachment?: string | null;
  outputFiles?: { name: string; url: string }[] | any;
  createdAt: string;
  updatedAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string; bg: string; border: string; icon: any }[] = [
  { key: 'TODO',        label: 'To Do',       color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   icon: Circle       },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: Clock        },
  { key: 'PENDING',     label: 'Pending',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: Hourglass    },
  { key: 'COMPLETED',   label: 'Completed',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  LOW:    { label: 'Low',    color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-400/20'   },
  NORMAL: { label: 'Normal', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-400/20'    },
  HIGH:   { label: 'High',   color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-400/20'  },
  URGENT: { label: 'Urgent', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-400/20'     },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TaskStatus }) {
  const col = STATUS_COLUMNS.find(c => c.key === status)!;
  const Icon = col.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${col.bg} ${col.color} ${col.border}`}>
      <Icon className="w-3 h-3" />
      {col.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Flag className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function Avatar({ user }: { user: AssignedUser }) {
  const src = user.profileImage ? `${BACKEND}${user.profileImage}` : null;
  const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  if (src) {
    return <img src={src} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-gradient-to-tr from-indigo-500 to-purple-500 flex-shrink-0 border border-white/10">
      {initials}
    </div>
  );
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate?: string, status?: TaskStatus) {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
interface TaskModalProps {
  task?: Task | null;
  employees: any[];
  onClose: () => void;
  onSaved: () => void;
  isAdmin: boolean;
  mode?: 'view' | 'edit';
  canEditTasks?: boolean;
  canCreateTasks?: boolean;
  currentUserId?: string;
  onModeChange?: (mode: 'view' | 'edit') => void;
}

function CustomSelect({
  value,
  onChange,
  options,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; element: React.ReactNode }[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <div
        className={`w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium flex justify-between items-center ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <div className="pointer-events-none">{selectedOption ? selectedOption.element : 'Select...'}</div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center ${value === opt.value ? 'bg-slate-50 dark:bg-white/5' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <div className="pointer-events-none">{opt.element}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskModal({ task, employees, onClose, onSaved, isAdmin: admin, mode = 'edit', canEditTasks = false, canCreateTasks = false, currentUserId, onModeChange }: TaskModalProps) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    startDate: task?.startDate ? task.startDate.slice(0, 10) : '',
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
    priority: (task?.priority || 'NORMAL') as TaskPriority,
    status: (task?.status || 'TODO') as TaskStatus,
    assignedToId: task?.assignedToId || '',
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [outputFiles, setOutputFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const isCreating = !task;
  const isReadOnly = mode === 'view' || (isCreating ? !canCreateTasks : !canEditTasks);
  const canUpdateWorkerFields = !isReadOnly || task?.assignedToId === currentUserId;
  const canEditStatus = canUpdateWorkerFields;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdateWorkerFields) return;
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.assignedToId) return toast.error('Please assign the task to a user');
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v as string));
      if (attachment) formData.append('attachment', attachment);
      if (!isCreating && outputFiles.length > 0) {
        outputFiles.forEach((file) => {
          formData.append('outputFiles', file);
        });
      }

      if (task) {
        await api.patch(`/tasks/${task.id}`, formData);
        toast.success('Task updated!');
      } else {
        await api.post('/tasks', formData);
        toast.success('Task Assigned & Notification Sent');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed';
  const label = 'block text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex-shrink-0 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {isReadOnly ? 'Task Details' : task ? 'Edit Task' : 'Create New Task'}
            {isReadOnly && canEditTasks && onModeChange && (
              <button
                type="button"
                onClick={() => onModeChange('edit')}
                className="p-1.5 ml-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors flex items-center gap-1 text-xs"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className={label}>Title *</label>
            <input
              type="text"
              className={field}
              placeholder="e.g. Review monthly reports"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              disabled={isReadOnly}
            />
          </div>

          {/* Description */}
          <div>
            <label className={label}>Description</label>
            <textarea
              className={`${field} resize-none`}
              rows={3}
              placeholder="Optional task description..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              disabled={!canUpdateWorkerFields}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Start Date</label>
              <input 
                type="date" 
                className={field} 
                value={form.startDate} 
                min={task?.startDate ? undefined : todayStr}
                onChange={e => setForm({ ...form, startDate: e.target.value })} 
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className={label}>Due Date</label>
              <input 
                type="date" 
                className={field} 
                value={form.dueDate} 
                min={form.startDate || (task?.dueDate ? undefined : todayStr)}
                onChange={e => setForm({ ...form, dueDate: e.target.value })} 
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Priority</label>
              <CustomSelect
                value={form.priority}
                onChange={(val) => setForm({ ...form, priority: val as TaskPriority })}
                options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({
                  value: k,
                  label: v.label,
                  element: <PriorityBadge priority={k as TaskPriority} />
                }))}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className={label}>Status</label>
              <CustomSelect
                value={form.status}
                onChange={async (val) => {
                  const newStatus = val as TaskStatus;
                  setForm({ ...form, status: newStatus });
                }}
                disabled={!canEditStatus}
                options={STATUS_COLUMNS.map(c => ({
                  value: c.key,
                  label: c.label,
                  element: <StatusBadge status={c.key} />
                }))}
              />
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className={label}>Assign To *</label>
            <CustomSelect
              value={form.assignedToId}
              onChange={(val) => setForm({ ...form, assignedToId: val })}
              options={[
                { value: '', label: '— Select employee —', element: <span className="text-slate-500 dark:text-gray-400">— Select employee —</span> },
                ...employees.map(emp => ({
                  value: emp.id,
                  label: emp.name,
                  element: (
                    <div className="flex items-center gap-2">
                      <Avatar user={emp} />
                      <span className="font-semibold text-slate-800 dark:text-gray-200">{emp.name}</span>
                      <span className="text-xs text-slate-400 dark:text-gray-500">({emp.employeeId})</span>
                    </div>
                  )
                }))
              ]}
              disabled={isReadOnly}
            />
          </div>

          {/* Attachment */}
          <div>
            <label className={label}>Attachment (Optional)</label>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-black/20 border border-dashed border-slate-300 dark:border-white/20 hover:border-indigo-500/50 rounded-xl px-4 py-2.5 text-slate-500 dark:text-gray-400 cursor-pointer transition-all">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                  <span className="text-sm truncate font-medium">{attachment ? attachment.name : 'Select file or screenshot'}</span>
                  <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                </label>
                {attachment && (
                  <button type="button" onClick={() => setAttachment(null)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
            {task?.attachment && task.attachment !== '' && !attachment && (
              <div className="mt-2">
                <a href={task.attachment} target="_blank" rel="noopener noreferrer" className="inline-block cursor-pointer hover:opacity-80 transition-opacity relative group">
                  <img src={task.attachment} alt="Attachment" className="max-h-32 rounded-lg object-contain border border-slate-200 dark:border-white/10" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Search className="w-6 h-6 text-white" />
                  </div>
                </a>
                <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1">
                  <Search className="w-3 h-3" /> Click image to view / download
                </p>
              </div>
            )}
          </div>

          {/* Final Output Image */}
          {!isCreating && (
            <div>
              <label className={label}>Final Output Files / Images (Optional)</label>
              {canUpdateWorkerFields && (
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-black/20 border border-dashed border-slate-300 dark:border-white/20 hover:border-emerald-500/50 rounded-xl px-4 py-3 text-slate-500 dark:text-gray-400 cursor-pointer transition-all w-full">
                    <Paperclip className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-medium">Select output files...</span>
                    <input type="file" multiple accept="image/*, .pdf" className="hidden" onChange={(e) => setOutputFiles(Array.from(e.target.files || []))} />
                  </label>
                  
                  {outputFiles.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                      {outputFiles.map((file, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 aspect-square">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                              <span className="text-xs font-bold text-slate-400">PDF</span>
                            </div>
                          )}
                          <button type="button" onClick={() => setOutputFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-sm z-10">
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1 text-[10px] text-white truncate pointer-events-none">
                            {file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {task?.outputFiles && Array.isArray(task.outputFiles) && task.outputFiles.length > 0 && outputFiles.length === 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {task.outputFiles.map((fObj: any, idx: number) => {
                    // Backwards compatibility for string URLs vs { name, url } objects
                    const url = typeof fObj === 'string' ? fObj : fObj.url;
                    const name = typeof fObj === 'string' ? `File ${idx + 1}` : fObj.name;
                    return (
                      <div key={idx} className="relative group">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block cursor-pointer hover:opacity-80 transition-opacity">
                          {String(url).match(/\.(jpeg|jpg|gif|png)$/) != null ? (
                            <img src={url} alt={`Final Output ${idx + 1}`} className="h-24 w-auto rounded-lg object-contain border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/50" />
                          ) : (
                            <div className="h-24 w-24 flex flex-col items-center justify-center bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                              <Paperclip className="w-8 h-8 text-emerald-500 mb-1" />
                              <span className="text-[10px] text-slate-500 truncate w-20 text-center">{name}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                            <Search className="w-6 h-6 text-white" />
                          </div>
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex-shrink-0 flex gap-3 bg-white dark:bg-slate-900">
            {canUpdateWorkerFields ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Saving…' : task ? 'Update Task' : 'Create Task'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl transition-all border border-slate-200 dark:border-white/10 font-medium text-sm"
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({
  task, index, canEdit, canDelete, onEdit, onView, onDelete,
}: {
  task: Task; index: number; canEdit: boolean; canDelete: boolean;
  onEdit: (t: Task) => void; onView: (t: Task) => void; onDelete: (id: string) => void;
}) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm transition-all cursor-grab active:cursor-grabbing flex flex-col gap-3 relative select-none ${
            snapshot.isDragging
              ? 'shadow-2xl border-blue-500 ring-2 ring-blue-500/30 rotate-1'
              : 'border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500'
          }`}
          onClick={() => onView(task)}
        >
          {/* Action buttons (hidden by default, shown on group hover) */}
          {(canEdit || canDelete) && (
            <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 z-10 bg-white/90 dark:bg-slate-800/90 rounded-md p-1 backdrop-blur-sm">
              {canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                  className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Task Title with Line Clamp */}
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug pr-8">
            {task.title}
          </h4>
          
          {/* Task Meta Data (Bottom Row) */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              {/* Priority Badge */}
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase">
                {task.priority || 'NORMAL'}
              </span>
              
              {/* Attachment Icon (If exists) */}
              {task.attachment && (
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </div>
            
            {/* Assignee Avatar */}
            {task.assignedTo && (
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-800 shadow-sm" title={task.assignedTo?.name}>
                {task.assignedTo?.name ? task.assignedTo.name.substring(0, 2).toUpperCase() : 'U'}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const openDetails = useDetailsStore(state => state.openDetails);
  const { user, loading: authLoading } = useAuth();
  const { scope: getScope } = usePermissions();

  const taskScope = getScope('Tasks', 'canRead');
  const isAdminUser = taskScope === 'All';
  const canCreateTasks = checkPermission(user, 'Tasks', 'create');
  const canEditTasks = checkPermission(user, 'Tasks', 'edit');
  const canDeleteTasks = checkPermission(user, 'Tasks', 'delete');

  const [view, setView]             = useState<'list' | 'kanban'>('list');
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter]     = useState<TaskStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL');
  const [dateFilter, setDateFilter]         = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalMode, setModalMode]   = useState<'view' | 'edit'>('view');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<{count: number, tasks: any[]}>({ count: 0, tasks: [] });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsStart, setAnalyticsStart] = useState(new Date().toISOString().slice(0, 10));
  const [analyticsEnd, setAnalyticsEnd] = useState(new Date().toISOString().slice(0, 10));

  const fetchAnalytics = useCallback(async () => {
    if (typeof window !== 'undefined' && !Cookies.get('token')) return;
    try {
      setAnalyticsLoading(true);
      let url = '/tasks/analytics';
      if (isAdminUser) {
        url += `?startDate=${analyticsStart}&endDate=${analyticsEnd}`;
      }
      const res = await api.get(url);
      setAnalyticsData(res.data);
    } catch (e: any) {
      // Avoid raw console.error(e) as it triggers Next.js dev overlay on Axios 401s
      console.warn('Failed to load task analytics:', e?.response?.data?.message || e.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [isAdminUser, analyticsStart, analyticsEnd]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchAnalytics();
  }, [fetchAnalytics, authLoading, user]);

  const fetchTasks = useCallback(async () => {
    if (typeof window !== 'undefined' && !Cookies.get('token')) return [];
    try {
      setLoading(true);
      const res = await api.get('/tasks');
      const data = Array.isArray(res.data) ? res.data : [];
      setTasks(data);
      return data;
    } catch (error: any) {
      toast.error(error?.response?.data?.message ? `Tasks: ${error.response.data.message}` : 'Failed to load tasks');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (typeof window !== 'undefined' && !Cookies.get('token')) return;
    try {
      const res = await api.get('/employees?purpose=task_assignment');
      setEmployees(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch {
      console.error('Failed to fetch employees');
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    fetchTasks().then((loadedTasks) => {
      // Check URL for ID parameter (e.g. from notifications)
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const taskId = searchParams.get('id');
        if (taskId) {
          const taskToOpen = loadedTasks.find((t: Task) => t.id === taskId);
          if (taskToOpen) {
            setEditingTask(taskToOpen);
            setModalMode('view');
            setModalOpen(true);
            
            // Clean up the URL
            const url = new URL(window.location.href);
            url.searchParams.delete('id');
            window.history.replaceState({}, '', url.toString());
          }
        }
      }
    });
    if (canCreateTasks || canEditTasks) fetchEmployees();
  }, [fetchTasks, fetchEmployees, canCreateTasks, canEditTasks, authLoading, user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task permanently?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted');
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch {
      toast.error('Failed to delete task');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as TaskStatus;
    const taskId    = result.source.droppableId === result.destination.droppableId
      ? null
      : result.draggableId;

    if (!taskId) return; // same column, no-op

    // Optimistic update
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    );

    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      toast.success(`Moved to ${STATUS_COLUMNS.find(c => c.key === newStatus)?.label}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update status');
      fetchTasks(); // rollback
    }
  };

  // ── Filtering ──
  const now = new Date();
  const filtered = tasks.filter(t => {
    const matchSearch = !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus   = statusFilter   === 'ALL' || t.status   === statusFilter;
    const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

    let matchDate = true;
    if (dateFilter !== 'all') {
      const taskDate = new Date(t.createdAt);
      if (dateFilter === 'today') {
        matchDate = taskDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        matchDate = taskDate.toDateString() === yesterday.toDateString();
      } else if (dateFilter === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        matchDate = taskDate >= sevenDaysAgo;
      } else if (dateFilter === 'month') {
        matchDate = taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        matchDate = taskDate >= start && taskDate <= end;
      }
    }

    return matchSearch && matchStatus && matchPriority && matchDate;
  });

  const tasksByStatus = (status: TaskStatus) => filtered.filter(t => t.status === status);

  const selectCls = 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none cursor-pointer font-medium appearance-none pr-8';

  return (
    <PageGuard moduleName="Tasks">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ─── Analytics Section ─── */}
      {!isAdminUser ? (
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm font-semibold mb-1">Tasks Completed Today</p>
            <h2 className="text-3xl font-bold">{analyticsLoading ? '...' : analyticsData.count}</h2>
          </div>
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                Task Completion Report
              </h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">Total Tasks Completed in Selected Period: <span className="font-bold text-slate-900 dark:text-white">{analyticsLoading ? '...' : analyticsData.count}</span></p>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="date" 
                value={analyticsStart} 
                onChange={(e) => setAnalyticsStart(e.target.value)}
                className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input 
                type="date" 
                value={analyticsEnd} 
                onChange={(e) => setAnalyticsEnd(e.target.value)}
                className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <button 
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                Filter
              </button>
            </div>
          </div>

          {analyticsData.tasks.length > 0 && (
            <div className="overflow-x-auto border border-slate-100 dark:border-white/5 rounded-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Task Title</th>
                    <th className="px-4 py-3 font-semibold">Completed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {analyticsData.tasks.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{t.assignedTo?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{t.title}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(t.completedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Task Management</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm font-medium">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
            {taskScope === 'Department' && <span className="ml-1.5 text-blue-500 font-semibold">(Department View)</span>}
            {taskScope === 'Own' && <span className="ml-1.5 text-amber-500 font-semibold">(My Tasks)</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search tasks…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-52 font-medium"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={selectCls}>
              <option value="ALL">All Statuses</option>
              {STATUS_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Priority filter */}
          <div className="relative">
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)} className={selectCls}>
              <option value="ALL">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select 
                value={dateFilter} 
                onChange={e => setDateFilter(e.target.value)} 
                className={selectCls}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-1">
            <button 
              onClick={() => setView('list')}
              title="List View"
              className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-white dark:bg-white/10 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button 
              onClick={() => setView('kanban')}
              title="Kanban View"
              className={`p-2 rounded-md transition-all ${view === 'kanban' ? 'bg-white dark:bg-white/10 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </button>
          </div>

          {/* Create button — shown only for users with Create permission */}
          {canCreateTasks && (
            <button
              onClick={() => { setEditingTask(null); setModalMode('edit'); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </button>
          )}
        </div>
      </div>


      {/* ─── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {!loading && view === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="p-4 rounded-tl-xl">Task Name</th>
                <th className="p-4">Assigned To</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4">Start Date</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Created</th>
                {(canEditTasks || canDeleteTasks) && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-sm text-slate-600 dark:text-slate-300 divide-y divide-slate-100 dark:divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={(canEditTasks || canDeleteTasks) ? 8 : 7} className="px-5 py-16 text-center text-slate-400 dark:text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-full">
                        <CheckSquare className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">No tasks found</p>
                        <p className="text-sm">
                          {canCreateTasks ? 'Create your first task using the button above.' : taskScope === 'Department' ? 'No tasks found in your department.' : 'No tasks have been assigned to you yet.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(task => {
                  const overdue = isOverdue(task.dueDate, task.status);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => { setEditingTask(task); setModalMode('view'); setModalOpen(true); }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    >
                      <td className="p-4 font-medium text-slate-800 dark:text-slate-200 w-1/3">
                        <p className="line-clamp-2 leading-snug">{task.title}</p>
                        {task.description && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[250px] truncate font-normal">{task.description}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-[10px]">
                            {task.assignedTo?.name ? task.assignedTo.name.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div className="flex flex-col">
                            <span className="truncate max-w-[120px] font-medium text-slate-700 dark:text-slate-300">{task.assignedTo?.name || 'Unassigned'}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{task.assignedTo?.employeeId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4"><PriorityBadge priority={task.priority} /></td>
                      <td className="p-4">
                        {canEditTasks || task.assignedToId === user?.id ? (
                          <span className="inline-flex items-center justify-between min-w-[110px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm group-hover:border-blue-300 dark:group-hover:border-blue-500/50 transition-colors relative overflow-hidden">
                            <select
                              value={task.status}
                              onClick={e => e.stopPropagation()}
                              onChange={async e => {
                                const newStatus = e.target.value as TaskStatus;
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
                                try {
                                  await api.patch(`/tasks/${task.id}`, { status: newStatus });
                                  toast.success('Status updated');
                                } catch {
                                  toast.error('Failed to update status');
                                  fetchTasks();
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            >
                              {STATUS_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                            <span className="pointer-events-none text-slate-700 dark:text-slate-300">{task.status || 'To Do'}</span>
                            <svg className="w-3 h-3 text-slate-400 ml-2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </span>
                        ) : (
                          <StatusBadge status={task.status} />
                        )}
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">{fmtDate(task.startDate)}</td>
                      <td className="p-4 text-xs font-medium">
                        <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                          {overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          {fmtDate(task.dueDate)}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-400 dark:text-slate-500">{fmtDate(task.createdAt)}</td>
                      {(canEditTasks || canDeleteTasks) && (
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEditTasks && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingTask(task); setModalMode('edit'); setModalOpen(true); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteTasks && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                disabled={deletingId === task.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === task.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />
                                }
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════ KANBAN VIEW ═══════════════ */}
      {!loading && view === 'kanban' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-8 h-[calc(100vh-220px)] hide-scrollbar mt-6">
            {STATUS_COLUMNS.map(col => {
              const colTasks = tasksByStatus(col.key);
              const Icon = col.icon;
              return (
                <div key={col.key} className="flex-none w-[340px] flex flex-col bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
                  {/* Column header */}
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className={`font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ${col.color}`}>
                      <Icon className="w-4 h-4" /> {col.label}
                    </h3>
                    <span className={`bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full ${col.color}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={col.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-[300px] transition-all rounded-xl ${
                          snapshot.isDraggingOver
                            ? `${col.border} ${col.bg}`
                            : ''
                        }`}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex flex-col items-center justify-center h-24 text-slate-300 dark:text-gray-600 text-xs font-semibold gap-2">
                            <Icon className="w-5 h-5" />
                            <span>Drop tasks here</span>
                          </div>
                        )}
                        {colTasks.map((task, index) => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            index={index}
                            canEdit={canEditTasks}
                            canDelete={canDeleteTasks}
                            onView={t => openDetails('task', t.id, t)}
                            onEdit={t => { setEditingTask(t); setModalMode('edit'); setModalOpen(true); }}
                            onDelete={handleDelete}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Quick-add button in each column for users with create permission */}
                  {canCreateTasks && (
                    <button
                      onClick={() => { setEditingTask(null); setModalMode('edit'); setModalOpen(true); }}
                      className="mt-3 w-full py-2.5 text-xs font-semibold text-slate-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 border border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400/40 rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add task
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* ─── Create / Edit Modal ─── */}
      {modalOpen && (
        <TaskModal
          task={editingTask}
          employees={employees}
          isAdmin={isAdminUser}
          mode={modalMode}
          canEditTasks={canEditTasks}
          canCreateTasks={canCreateTasks}
          currentUserId={user?.id}
          onModeChange={(mode) => setModalMode(mode)}
          onClose={() => { setModalOpen(false); setEditingTask(null); }}
          onSaved={fetchTasks}
        />
        )}
      </div>
    </PageGuard>
  );
}
