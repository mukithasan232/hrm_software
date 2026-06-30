export const calculateWorkingHours = (checkIn: Date | string, checkOut: Date | string | null): string => {
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : new Date().getTime();

  if (isNaN(start) || isNaN(end) || start > end) {
    return '0h 0m';
  }

  const diffMs = end - start;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${diffHours}h ${diffMinutes}m`;
};
