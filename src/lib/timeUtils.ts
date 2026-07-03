export const calculateWorkingHours = (checkIn: Date | string, checkOut: Date | string | null): string => {
  if (!checkOut) {
    return '—';
  }

  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();

  if (isNaN(start) || isNaN(end) || start > end) {
    return '0h 0m';
  }

  const diffMs = end - start;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${diffHours}h ${diffMinutes}m`;
};

export const formatTimeStr12Hour = (timeStr: string | null | undefined): string => {
  if (!timeStr || timeStr.trim() === '') return 'N/A';
  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr;
  
  const [hours, minutes] = timeStr.split(':');
  if (!hours || !minutes) return timeStr;
  
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const paddedH = h12.toString().padStart(2, '0');
  const paddedM = m.toString().padStart(2, '0');
  
  return `${paddedH}:${paddedM} ${ampm}`;
};
