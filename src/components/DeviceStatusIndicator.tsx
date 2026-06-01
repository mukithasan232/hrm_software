import React from 'react';

interface DeviceStatusIndicatorProps {
  deviceStatus: { reachable: boolean; error?: string } | null;
}

export default function DeviceStatusIndicator({ deviceStatus }: DeviceStatusIndicatorProps) {
  // Requirement 1: Remove "Checking device..." completely
  // If the status is not yet determined, we render nothing to keep the header clean.
  if (!deviceStatus) return null;

  const isOnline = deviceStatus.reachable;

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border backdrop-blur-md transition-colors ${
      isOnline 
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
    }`}>
      <span className="relative flex h-2 w-2">
        {isOnline && (
          // Requirement 3: Blinking effect using Tailwind's ping animation
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
      </span>
      <span className="text-[11px] font-bold tracking-wide uppercase">
        {isOnline ? 'Device Online' : 'Device Offline'}
      </span>
    </div>
  );
}
