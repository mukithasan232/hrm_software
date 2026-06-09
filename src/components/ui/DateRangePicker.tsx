import React, { useState, useEffect, useRef } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  value: { range: string; start: string; end: string };
  onChange: (value: { range: string; start: string; end: string }) => void;
  disabled?: boolean;
}

export function DateRangePicker({ value, onChange, disabled }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(value.range);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (value.range === 'custom' && value.start && value.end) {
      return {
        from: new Date(value.start),
        to: new Date(value.end)
      };
    }
    return undefined;
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      onChange({ range: preset, start: '', end: '' });
      setIsOpen(false);
    }
  };

  const handleRangeSelect = (newRange: DateRange | undefined) => {
    setRange(newRange);
    setSelectedPreset('custom');
    if (newRange?.from && newRange?.to) {
      const startStr = format(newRange.from, 'yyyy-MM-dd');
      const endStr = format(newRange.to, 'yyyy-MM-dd');
      onChange({ range: 'custom', start: startStr, end: endStr });
      // Don't auto-close to let user see selection, but they can click outside
    }
  };

  const getDisplayText = () => {
    if (value.range === 'today') return 'Today';
    if (value.range === 'week') return 'Last 7 Days';
    if (value.range === 'month') return 'Last 30 Days';
    if (value.range === 'custom' && value.start && value.end) {
      return `${format(new Date(value.start), 'MMM dd, yyyy')} - ${format(new Date(value.end), 'MMM dd, yyyy')}`;
    }
    return 'Select Date Range';
  };

  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Last 7 Days' },
    { id: 'month', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium w-full sm:w-auto min-w-[220px] justify-between"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{getDisplayText()}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col sm:flex-row">
          {/* Presets Sidebar */}
          <div className="w-full sm:w-48 bg-slate-50 dark:bg-black/20 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-white/10 p-2 flex flex-col gap-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`text-left px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  selectedPreset === preset.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          {selectedPreset === 'custom' && (
            <div className="p-4">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                pagedNavigation
                className="text-slate-900 dark:text-white"
                classNames={{
                  day_selected: "bg-indigo-600 text-white hover:bg-indigo-500",
                  day_today: "font-bold text-indigo-600 dark:text-indigo-400",
                  day: "rounded-md hover:bg-slate-100 dark:hover:bg-white/10 p-1 m-1 text-sm transition-all",
                  caption: "font-bold text-sm mb-2 px-1 flex justify-between items-center",
                  nav_button: "hover:bg-slate-100 dark:hover:bg-white/10 rounded-md p-1",
                  month: "m-2",
                  months: "flex flex-col sm:flex-row gap-4",
                  table: "w-full border-collapse",
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
