'use client';

import React from 'react';
import { X } from 'lucide-react';
import DesignationForm from './DesignationForm';

interface DesignationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSubmit: (data: { name: string; weekendDays: string[] }) => void;
  isLoading?: boolean;
}

export default function DesignationModal({ isOpen, onClose, initialData, onSubmit, isLoading }: DesignationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              {initialData ? 'Edit Designation' : 'Add New Designation'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Configure designation name and weekend days.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <DesignationForm 
            initialData={initialData} 
            onSubmit={onSubmit} 
            isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}
