'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard Error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Something went wrong!
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
        We've encountered an unexpected error while loading this page. You can try refreshing the view.
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
      >
        <RefreshCcw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
