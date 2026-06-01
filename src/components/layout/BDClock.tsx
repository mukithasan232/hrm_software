'use client';
import { useState, useEffect } from 'react';
import { Clock as ClockIcon } from 'lucide-react';

export default function BDClock() {
  const [time, setTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateClock = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setTime(formatter.format(now));
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <div className="hidden md:block h-8 w-32 bg-slate-100 dark:bg-white/5 animate-pulse rounded-lg" />;
  }

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-lg shadow-sm">
      <ClockIcon className="w-4 h-4 text-brand-primary animate-pulse" />
      <span className="text-sm font-bold text-brand-primary font-mono tracking-tight">
        {time} <span className="text-[10px] uppercase opacity-75">BD</span>
      </span>
    </div>
  );
}
