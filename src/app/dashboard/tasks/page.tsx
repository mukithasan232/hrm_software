'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DragDropContext, Droppable, Draggable, DropResult,
} from '@hello-pangea/dnd';
import {
  Plus, LayoutList, Columns3, Search, X, Loader2, Pencil, Trash2,
  CalendarDays, User as UserIcon, ChevronDown, Flag, AlertTriangle,
  CheckCircle2, Clock, Circle, Hourglass,
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';

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
}

function TaskModal({ task, employees, onClose, onSaved, isAdmin: admin }: TaskModalProps) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    startDate: task?.startDate ? task.startDate.slice(0, 10) : '',
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
    priority: (task?.priority || 'NORMAL') as TaskPriority,
    status: (task?.status || 'TODO') as TaskStatus,
    assignedToId: task?.assignedToId || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.assignedToId) return toast.error('Please assign the task to a user');
    setSaving(true);
    try {
      if (task) {
        await api.patch(`/tasks/${task.id}`, form);
        toast.success('Task updated!');
      } else {
        await api.post('/tasks', form);
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

  const field = 'w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium';
  const label = 'block text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
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
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Start Date</label>
              <input type="date" className={field} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className={label}>Due Date</label>
              <input type="date" className={field} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Priority</label>
              <select className={`${field} appearance-none cursor-pointer`} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className={label}>Status</label>
              <select className={`${field} appearance-none cursor-pointer`} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className={label}>Assign To *</label>
            <select
              className={`${field} appearance-none cursor-pointer`}
              value={form.assignedToId}
              onChange={e => setForm({ ...form, assignedToId: e.target.value })}
              required
            >
              <option value="">— Select employee —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({
  task, index, canManage, onEdit, onDelete,
}: {
  task: Task; index: number; canManage: boolean;
  onEdit: (t: Task) => void; onDelete: (id: string) => void;
}) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group relative bg-white dark:bg-slate-800/80 border rounded-2xl p-4 shadow-sm transition-all select-none cursor-grab active:cursor-grabbing
            ${snapshot.isDragging
              ? 'shadow-2xl border-indigo-500/50 ring-2 ring-indigo-500/30 rotate-1'
              : 'border-slate-200 dark:border-white/10 hover:border-indigo-400/40 dark:hover:border-white/20 hover:shadow-md'
            }`}
        >
          {/* Priority dot */}
          <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${
            task.priority === 'URGENT' ? 'bg-red-500 animate-pulse' :
            task.priority === 'HIGH'   ? 'bg-orange-500' :
            task.priority === 'NORMAL' ? 'bg-blue-500' : 'bg-slate-400'
          }`} />

          <p className="text-sm font-bold text-slate-900 dark:text-white pr-4 leading-snug mb-2">
            {task.title}
          </p>

          {task.description && (
            <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2 mb-3">
              {task.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Avatar user={task.assignedTo} />
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-300 truncate max-w-[90px]">
                {task.assignedTo.name.split(' ')[0]}
              </span>
            </div>

            {task.dueDate && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                overdue ? 'text-red-500' : 'text-slate-500 dark:text-gray-400'
              }`}>
                {overdue && <AlertTriangle className="w-3 h-3" />}
                <CalendarDays className="w-3 h-3" />
                {fmtDate(task.dueDate)}
              </div>
            )}
          </div>

          <div className="mt-2.5">
            <PriorityBadge priority={task.priority} />
          </div>

          {/* Action buttons */}
          {canManage && (
            <div className="absolute top-2 right-7 hidden group-hover:flex items-center gap-1">
              <button
                onClick={() => onEdit(task)}
                className="p-1 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-500 transition-colors shadow-sm"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="p-1 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 transition-colors shadow-sm"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuth();
  const { can, scope: getScope } = usePermissions();

  // Derive exact RBAC scope for Tasks read — 'No'|'Own'|'Department'|'All'
  const taskScope = getScope('Tasks', 'canRead');
  const isAdminUser = taskScope === 'All';
  const canManageTasks = can('Tasks', 'canCreate'); // true only for admins / designations with Create permission

  const [view, setView]             = useState<'list' | 'kanban'>('list');
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter]     = useState<TaskStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks');
      // Guard: ensure the API returned an array, not an error object
      const data = Array.isArray(res.data) ? res.data : [];
      setTasks(data);
    } catch (error: any) {
      // Log full response so devtools shows the exact server error
      if (error?.response) {
        console.error('[Tasks] Fetch failed — HTTP', error.response.status);
        console.error('[Tasks] Server response:', error.response.data);
        console.error('[Tasks] Headers:', error.response.headers);
      } else {
        console.error('[Tasks] Fetch failed — network/unexpected error:', error?.message);
      }
      const serverMsg = error?.response?.data?.message;
      toast.error(serverMsg ? `Tasks: ${serverMsg}` : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch {
      console.error('Failed to fetch employees');
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    if (canManageTasks) fetchEmployees();
  }, [fetchTasks, fetchEmployees, canManageTasks]);

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
  const filtered = tasks.filter(t => {
    const matchSearch = !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus   = statusFilter   === 'ALL' || t.status   === statusFilter;
    const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const tasksByStatus = (status: TaskStatus) => filtered.filter(t => t.status === status);

  const selectCls = 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none cursor-pointer font-medium appearance-none pr-8';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

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

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-1">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                view === 'list'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <LayoutList className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                view === 'kanban'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <Columns3 className="w-4 h-4" /> Kanban
            </button>
          </div>

          {/* Create button — shown only for users with Create permission */}
          {canManageTasks && (
            <button
              onClick={() => { setEditingTask(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </button>
          )}
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map(col => {
          const Icon = col.icon;
          const count = tasks.filter(t => t.status === col.key).length;
          return (
            <div
              key={col.key}
              onClick={() => setStatusFilter(statusFilter === col.key ? 'ALL' : col.key)}
              className={`bg-white dark:bg-white/5 border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md shadow-sm ${
                statusFilter === col.key
                  ? `${col.border} ring-2 ring-offset-0 ${col.bg}`
                  : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <div className={`flex items-center gap-2 ${col.color} text-xs font-bold uppercase tracking-wider mb-1`}>
                <Icon className="w-3.5 h-3.5" />
                {col.label}
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{count}</p>
            </div>
          );
        })}
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {!loading && view === 'list' && (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-black/40 text-slate-700 dark:text-gray-300 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
                  <th className="px-5 py-4 font-bold">Task</th>
                  <th className="px-5 py-4 font-bold">Assigned To</th>
                  <th className="px-5 py-4 font-bold">Priority</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold">Start Date</th>
                  <th className="px-5 py-4 font-bold">Due Date</th>
                  <th className="px-5 py-4 font-bold">Created</th>
                  {isAdminUser && <th className="px-5 py-4 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canManageTasks ? 8 : 7} className="px-5 py-16 text-center text-slate-400 dark:text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-slate-300 dark:text-gray-600" />
                        </div>
                        <p className="font-semibold">No tasks found</p>
                        <p className="text-xs">
                          {canManageTasks ? 'Create your first task using the button above.' : taskScope === 'Department' ? 'No tasks found in your department.' : 'No tasks have been assigned to you yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(task => {
                    const overdue = isOverdue(task.dueDate, task.status);
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors animate-in fade-in duration-200"
                      >
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 max-w-[200px] truncate">{task.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Avatar user={task.assignedTo} />
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">{task.assignedTo.name}</p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">{task.assignedTo.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><PriorityBadge priority={task.priority} /></td>
                        <td className="px-5 py-4">
                          {isAdminUser || task.assignedToId === user?.id ? (
                            <select
                              value={task.status}
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
                              className="text-xs font-semibold bg-transparent border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-slate-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                            >
                              {STATUS_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                          ) : (
                            <StatusBadge status={task.status} />
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-gray-300 font-medium">{fmtDate(task.startDate)}</td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-semibold flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-slate-600 dark:text-gray-300'}`}>
                            {overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                            {fmtDate(task.dueDate)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-400 dark:text-gray-500 font-medium">{fmtDate(task.createdAt)}</td>
                        {canManageTasks && (
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditingTask(task); setModalOpen(true); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(task.id)}
                                disabled={deletingId === task.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === task.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />
                                }
                              </button>
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
        </div>
      )}

      {/* ═══════════════ KANBAN VIEW ═══════════════ */}
      {!loading && view === 'kanban' && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUS_COLUMNS.map(col => {
              const colTasks = tasksByStatus(col.key);
              const Icon = col.icon;
              return (
                <div key={col.key} className="flex flex-col min-h-[400px]">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-4 py-3 rounded-2xl mb-3 border ${col.bg} ${col.border}`}>
                    <div className={`flex items-center gap-2 ${col.color} font-bold text-sm`}>
                      <Icon className="w-4 h-4" />
                      {col.label}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bg} ${col.color} border ${col.border}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={col.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-3 p-3 rounded-2xl min-h-[300px] transition-all border-2 border-dashed ${
                          snapshot.isDraggingOver
                            ? `${col.border} ${col.bg}`
                            : 'border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]'
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
                            canManage={canManageTasks}
                            onEdit={t => { setEditingTask(t); setModalOpen(true); }}
                            onDelete={handleDelete}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Quick-add button in each column for users with create permission */}
                  {canManageTasks && (
                    <button
                      onClick={() => { setEditingTask(null); setModalOpen(true); }}
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
          isAdmin={canManageTasks}
          onClose={() => { setModalOpen(false); setEditingTask(null); }}
          onSaved={fetchTasks}
        />
      )}
    </div>
  );
}
