'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TaskNav() {
  const pathname = usePathname();
  
  return (
    <div className="flex space-x-4 border-b border-slate-200 dark:border-white/10 mb-6 pb-2">
      <Link 
        href="/dashboard/tasks" 
        className={`pb-2 px-1 text-sm font-medium ${pathname === '/dashboard/tasks' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
      >
        Task Management
      </Link>
      <Link 
        href="/dashboard/tasks/report" 
        className={`pb-2 px-1 text-sm font-medium ${pathname === '/dashboard/tasks/report' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
      >
        Completion Report
      </Link>
    </div>
  );
}
