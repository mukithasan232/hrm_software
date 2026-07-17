import { AttendanceScheduler } from '../services/AttendanceScheduler';

export function initCronJobs() {
  console.log('[ZKCron] ⏱️  Delegating to AttendanceScheduler for background tasks...');
  AttendanceScheduler.start();
}
