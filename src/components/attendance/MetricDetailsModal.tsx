import React from 'react';
import { X, Calendar, User } from 'lucide-react';
import { toBDDisplay } from '@/lib/dateUtils';

interface MetricDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
}

export default function MetricDetailsModal({ isOpen, onClose, title, data }: MetricDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {title}
            <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs py-0.5 px-2 rounded-full font-bold">
              {data.length}
            </span>
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {data.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No details found.</p>
              </div>
            ) : (
              data.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      {item.userName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                    <Calendar className="w-3.5 h-3.5" />
                    {item.date ? toBDDisplay(new Date(item.date), 'dd MMM yyyy') : '--'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
