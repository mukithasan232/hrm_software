'use client';

import React from 'react';
import { X, Calendar, Bell } from 'lucide-react';
import { format } from 'date-fns';

export interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: any;
}

export default function NotificationModal({ isOpen, onClose, notification }: NotificationModalProps) {
  if (!isOpen || !notification) return null;

  const dispTitle = notification.titleEn || notification.titleBn || notification.title || 'Notification';
  const dispMsg = notification.messageEn || notification.messageBn || notification.message || '';
  const dateStr = notification.createdAt ? format(new Date(notification.createdAt), 'PPpp') : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Bell className="w-5 h-5 text-indigo-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Notification Details</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{dispTitle}</h3>
            {dateStr && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
                <Calendar className="w-3.5 h-3.5" />
                {dateStr}
              </div>
            )}
            <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-100 dark:border-white/5">
              {dispMsg}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-xl font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
