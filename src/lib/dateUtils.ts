import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const BD_TZ = 'Asia/Dhaka';

/**
 * Convert a UTC ISO string → readable Bangladesh time
 * Use this EVERYWHERE you display a timestamp in the UI
 * 
 * @example toBDDisplay("2026-06-08T18:25:00Z") 
 *          → "09 Jun 2026 12:25:00 AM"
 */
export function toBDDisplay(
  utcString: string | Date,
  fmt = 'dd MMM yyyy hh:mm:ss aa'
): string {
  if (!utcString) return '—';
  try {
    return formatInTimeZone(new Date(utcString), BD_TZ, fmt);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Combine a local date string + time string (from form inputs) 
 * into a UTC ISO string for sending to the backend/DB.
 * 
 * @example toUTCFromBD("2026-06-09", "00:25") 
 *          → "2026-06-08T18:25:00.000Z"  (correct UTC)
 */
export function toUTCFromBD(
  localDate: string, // "YYYY-MM-DD"
  localTime: string  // "HH:mm" or "HH:mm:ss"
): string {
  if (!localDate || !localTime) throw new Error('Date and time are required');
  // Explicitly construct an ISO string with +06:00 to guarantee absolute timezone immunity 
  // in all browser and Node.js environments.
  const localDateTimeString = `${localDate}T${localTime}:00+06:00`;
  return new Date(localDateTimeString).toISOString();
}

/**
 * Get today's date string in Bangladesh time (not server/UTC time)
 * Use this as the default value for date pickers in forms
 * 
 * @example getBDToday() → "2026-06-09"
 */
export function getBDToday(): string {
  return formatInTimeZone(new Date(), BD_TZ, 'yyyy-MM-dd');
}

/**
 * Get current datetime-local string in Bangladesh time
 * Use this for default value of datetime-local inputs
 */
export function getBDNowLocal(): string {
  return formatInTimeZone(new Date(), BD_TZ, "yyyy-MM-dd'T'HH:mm");
}
