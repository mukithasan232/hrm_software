import React, { useState, useEffect } from 'react';
import { Coffee, Utensils, CheckCircle2, Clock, Info } from 'lucide-react';

export const BreakCountdownWidget = ({ isCompact, data }: { isCompact: boolean, data: any }) => {
  const { user } = data;
  const dept = user?.customDepartment;

  const [timeState, setTimeState] = useState<{
    status: 'NO_CONFIG' | 'BEFORE_LUNCH' | 'LUNCH_ACTIVE' | 'BEFORE_SNACKS' | 'SNACKS_ACTIVE' | 'ALL_DONE';
    timeLeft: string | null;
  }>({ status: 'NO_CONFIG', timeLeft: null });

  useEffect(() => {
    const parseTimeString = (timeStr?: string | null): Date | null => {
      if (!timeStr || timeStr.includes('--:--')) return null;
      
      const now = new Date();
      if (timeStr.toLowerCase().includes('m')) {
        const [time, modifier] = timeStr.trim().split(/\s+/);
        if (!time || !modifier) return null;
        let [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        
        if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
        
        now.setHours(hours, minutes, 0, 0);
        return now;
      }
      
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return null;
      now.setHours(hours, minutes, 0, 0);
      return now;
    };

    const lunchStart = parseTimeString(dept?.lunchStartTime);
    const lunchEnd = parseTimeString(dept?.lunchEndTime);
    const snacksStart = parseTimeString(dept?.snacksStartTime);
    const snacksEnd = parseTimeString(dept?.snacksEndTime);

    const hasLunch = !!(lunchStart && lunchEnd);
    const hasSnacks = !!(snacksStart && snacksEnd);

    if (!hasLunch && !hasSnacks) {
      setTimeState({ status: 'NO_CONFIG', timeLeft: null });
      return;
    }

    const formatCountdown = (diffMs: number) => {
      if (diffMs <= 0) return '00:00:00';
      const totalSeconds = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const updateTimer = () => {
      const now = new Date();
      
      if (hasLunch && now < lunchStart!) {
        setTimeState({ status: 'BEFORE_LUNCH', timeLeft: formatCountdown(lunchStart!.getTime() - now.getTime()) });
      } else if (hasLunch && now >= lunchStart! && now <= lunchEnd!) {
        setTimeState({ status: 'LUNCH_ACTIVE', timeLeft: formatCountdown(lunchEnd!.getTime() - now.getTime()) });
      } else if (hasSnacks && now < snacksStart!) {
        setTimeState({ status: 'BEFORE_SNACKS', timeLeft: formatCountdown(snacksStart!.getTime() - now.getTime()) });
      } else if (hasSnacks && now >= snacksStart! && now <= snacksEnd!) {
        setTimeState({ status: 'SNACKS_ACTIVE', timeLeft: formatCountdown(snacksEnd!.getTime() - now.getTime()) });
      } else {
        setTimeState({ status: 'ALL_DONE', timeLeft: null });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [dept]);

  if (timeState.status === 'NO_CONFIG') {
    if (isCompact) return null;
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-md h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <Info className="w-5 h-5" />
          <p className="text-sm">Break schedule not configured for your department.</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (timeState.status) {
      case 'BEFORE_LUNCH':
        return (
          <>
            <Utensils className="w-10 h-10 text-orange-500 mb-2 animate-bounce" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Countdown to Lunch</h3>
            <div className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white my-3 tracking-tight">
              {timeState.timeLeft}
            </div>
            <p className="text-xs font-medium text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-3 py-1 rounded-full">Hang in there! 🍔</p>
          </>
        );
      case 'LUNCH_ACTIVE':
        return (
          <>
            <Utensils className="w-10 h-10 text-emerald-500 mb-2 animate-pulse" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-widest">🍔 Lunch Break Active!</h3>
            <div className="text-4xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400 my-3 tracking-tight">
              {timeState.timeLeft}
            </div>
            <p className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full">Enjoy your meal! Remaining</p>
          </>
        );
      case 'BEFORE_SNACKS':
        return (
          <>
            <Coffee className="w-10 h-10 text-amber-500 mb-2 animate-bounce" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Countdown to Snacks</h3>
            <div className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white my-3 tracking-tight">
              {timeState.timeLeft}
            </div>
            <p className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full">Time for a quick break soon ☕</p>
          </>
        );
      case 'SNACKS_ACTIVE':
        return (
          <>
            <Coffee className="w-10 h-10 text-blue-500 mb-2 animate-pulse" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-widest">☕ Snacks Break Active!</h3>
            <div className="text-4xl md:text-5xl font-black text-blue-600 dark:text-blue-400 my-3 tracking-tight">
              {timeState.timeLeft}
            </div>
            <p className="text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full">Recharge yourself! Remaining</p>
          </>
        );
      case 'ALL_DONE':
        return (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">All breaks completed!</h3>
            <p className="text-sm text-slate-500 mt-2">You've had all your scheduled breaks for today.</p>
          </>
        );
    }
  };

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-md h-full flex flex-col justify-between hover:border-orange-500/50 transition-all">
        <div className="flex items-center gap-2">
          {timeState.status.includes('LUNCH') ? <Utensils className="w-4 h-4 text-orange-500" /> : <Coffee className="w-4 h-4 text-orange-500" />}
          <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Break Timer</h3>
        </div>
        <div className="mt-2 text-xl font-black text-slate-800 dark:text-white">
          {timeState.status === 'ALL_DONE' ? 'Done' : timeState.timeLeft}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-md dark:shadow-2xl h-full flex flex-col items-center justify-center text-center min-h-[300px]">
      {renderContent()}
    </div>
  );
};
