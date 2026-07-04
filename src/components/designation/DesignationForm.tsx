'use client';

import React, { useState, useEffect } from 'react';

const DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface DesignationFormProps {
  initialData?: any;
  onSubmit: (data: { name: string; weekendDays: string[] }) => void;
  isLoading?: boolean;
}

export default function DesignationForm({ initialData, onSubmit, isLoading = false }: DesignationFormProps) {
  const [name, setName] = useState('');
  const [weekendDays, setWeekendDays] = useState<string[]>(['Sunday']);
  const [showWeekendModal, setShowWeekendModal] = useState(false);

  // Pre-fill State for Edit Mode
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      // Safely parse weekendDays (as Prisma returns it as JSON array or stringified JSON)
      let parsedWeekends = initialData.weekendDays;
      if (typeof parsedWeekends === 'string') {
        try {
          parsedWeekends = JSON.parse(parsedWeekends);
        } catch (e) {
          parsedWeekends = ['Sunday'];
        }
      }
      if (Array.isArray(parsedWeekends)) {
        setWeekendDays(parsedWeekends);
      }
    }
  }, [initialData]);

  // Handle Checkbox Toggles
  const toggleDay = (day: string) => {
    setWeekendDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day) // Remove if already selected
        : [...prev, day] // Add if not selected
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, weekendDays });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
          Designation Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Software Engineer"
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
          Weekend Configuration
        </label>
        <button
          type="button"
          onClick={() => setShowWeekendModal(true)}
          className="w-full px-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-between"
        >
          <span>{weekendDays.length > 0 ? weekendDays.join(', ') : 'No weekends'}</span>
          <span className="text-brand-primary">+ Add Weekend</span>
        </button>
      </div>

      {showWeekendModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowWeekendModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Select Weekend Days</h3>
            <div className="flex flex-col gap-2 mb-6">
              {DAYS_OF_WEEK.map((day) => (
                <label
                  key={day}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all ${
                    weekendDays.includes(day)
                      ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                      : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                    checked={weekendDays.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  <span className="text-sm font-semibold">{day}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowWeekendModal(false)}
              className="w-full px-4 py-2.5 bg-brand-primary text-white font-bold rounded-xl hover:opacity-90 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="px-6 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-primary/30 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          initialData ? 'Update Designation' : 'Create Designation'
        )}
      </button>
    </form>
  );
}
