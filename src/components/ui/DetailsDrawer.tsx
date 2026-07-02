'use client';
import { useDetailsStore } from '@/store/useDetailsStore';
import { X } from 'lucide-react';
// These will be fully fleshed out components later, for now we can render placeholders or minimal reads
import TaskReadView from './read-views/TaskReadView';
import EmployeeReadView from './read-views/EmployeeReadView';
import DepartmentReadView from './read-views/DepartmentReadView';
import UserReadView from './read-views/UserReadView';

export default function GlobalDetailsDrawer() {
  const { isOpen, entityType, entityId, entityData, closeDetails } = useDetailsStore();

  if (!isOpen) return null;

  const drawerWidth = entityType === 'task' ? 'max-w-5xl' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      {/* Drawer Container */}
      <div 
        className={`w-full bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 relative ${drawerWidth}`}
      >
        {/* Header with Close Button */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-white dark:bg-slate-900 z-10 flex-shrink-0">
          <h2 className="text-xl font-bold capitalize text-slate-800 dark:text-white">
            {entityType} Details
          </h2>
          <button 
            onClick={closeDetails}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-black/20">
          {entityType === 'task' && <TaskReadView id={entityId} initialData={entityData} />}
          {entityType === 'employee' && <EmployeeReadView id={entityId} initialData={entityData} />}
          {entityType === 'department' && <DepartmentReadView id={entityId} initialData={entityData} />}
          {entityType === 'user' && <UserReadView id={entityId as string} initialData={entityData} />}
          {/* Add more cases as features grow */}
          
          {!['task', 'employee', 'department', 'user'].includes(entityType || '') && (
            <div className="flex items-center justify-center h-40 text-slate-500">
              No detailed view implemented yet for {entityType}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
