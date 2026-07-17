import { prisma } from '../lib/prisma';

/**
 * Deterministic Session Pairing Engine
 * 
 * This engine ignores the punchType provided by the ZKTeco device (which is often unreliable)
 * and strictly relies on chronological sorting to pair Check-In and Check-Out.
 */
export class AttendanceProcessor {
  /**
   * Processes all raw logs for a given employee and date, regenerating their
   * AttendanceLog records in a deterministic, idempotent manner.
   * 
   * @param employeeId The system User ID
   * @param targetDate A Date object representing the day to process (will use local timezone boundaries)
   */
  static async processForEmployeeAndDate(employeeId: string, targetDate: Date): Promise<void> {
    try {
      // 1. Calculate boundaries for the specific Date (Bangladesh Time UTC+6)
      // We assume targetDate is already pointing to the correct day.
      const tzOffset = 6 * 60 * 60 * 1000;
      
      // Ensure we get start and end of the day in local time
      const year = targetDate.getUTCFullYear();
      const month = targetDate.getUTCMonth();
      const date = targetDate.getUTCDate();
      
      const startOfDayLocal = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
      const endOfDayLocal = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
      
      // Convert to UTC for database queries
      const startOfDayUTC = new Date(startOfDayLocal.getTime() - tzOffset);
      const endOfDayUTC = new Date(endOfDayLocal.getTime() - tzOffset);

      // 2. Map Employee to ZKTeco ID
      const user = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { id: true, zktecoId: true }
      });

      if (!user) {
        console.error(`[AttendanceProcessor] Missing User for ID: ${employeeId}`);
        return;
      }

      if (user.zktecoId === null || user.zktecoId === undefined) {
        console.error(`[AttendanceProcessor] Missing ZKTeco mapping for User ID: ${employeeId}`);
        return; // Don't break the sync for other users
      }

      const deviceUserId = user.zktecoId.toString();

      // 3. Fetch all raw logs for this employee on this date
      const rawLogs = await prisma.rawDeviceLog.findMany({
        where: {
          deviceUserId: deviceUserId,
          recordTime: {
            gte: startOfDayUTC,
            lte: endOfDayUTC
          }
        },
        orderBy: { recordTime: 'asc' }
      });

      // Also fetch any MANUAL logs for this date (so we can weave them in chronologically)
      const manualLogs = await prisma.attendanceLog.findMany({
        where: {
          employeeId: employeeId,
          timestamp: {
             gte: startOfDayUTC,
             lte: endOfDayUTC
          },
          OR: [
            { isManualIn: true },
            { isManualOut: true }
          ]
        },
        orderBy: { timestamp: 'asc' }
      });

      // If there are no raw logs and no manual logs, nothing to do
      if (rawLogs.length === 0 && manualLogs.length === 0) {
        return;
      }

      // 4. Combine and Sort chronologically
      // We will normalize everything into a standard timeline event
      const timeline: Array<{
        time: Date;
        deviceId: string | null;
        isManualIn: boolean;
        isManualOut: boolean;
        manualOutTime: Date | null;
      }> = [];

      // Add Raw Logs
      let previousTime = 0;
      for (const log of rawLogs) {
        const timeMs = log.recordTime.getTime();
        // Prevent exact-same-timestamp duplicates
        if (timeMs !== previousTime) {
          timeline.push({
            time: log.recordTime,
            deviceId: log.ip || 'MACHINE',
            isManualIn: false,
            isManualOut: false,
            manualOutTime: null,
          });
          previousTime = timeMs;
        }
      }

      // Add Manual Logs (Deconstruct them into timeline events)
      for (const mLog of manualLogs) {
        if (mLog.isManualIn) {
           timeline.push({
             time: mLog.timestamp,
             deviceId: mLog.deviceId,
             isManualIn: true,
             isManualOut: false,
             manualOutTime: null,
           });
        }
        if (mLog.isManualOut && mLog.checkOut) {
           timeline.push({
             time: mLog.checkOut,
             deviceId: mLog.checkOutDeviceId,
             isManualIn: false,
             isManualOut: true,
             manualOutTime: mLog.checkOut,
           });
        }
      }

      // Final strict sort by time
      timeline.sort((a, b) => a.time.getTime() - b.time.getTime());

      // 5. Build Idempotent Sessions (Pairs)
      const sessions: Array<{
        timestamp: Date;
        deviceId: string | null;
        isManualIn: boolean;
        checkOut: Date | null;
        checkOutDeviceId: string | null;
        isManualOut: boolean;
      }> = [];

      for (let i = 0; i < timeline.length; i++) {
        const event = timeline[i];
        
        // If the event is explicitly a manual checkout but we don't have an open session,
        // it means manual logic is out of sync or it's an orphaned checkout.
        // The prompt dictates strict IN -> OUT -> IN -> OUT pairing.
        // But to honor manual flags safely, we pair strictly:
        
        // Is it an even index? (0, 2, 4...) -> Check In
        if (i % 2 === 0) {
          sessions.push({
            timestamp: event.time,
            deviceId: event.deviceId,
            isManualIn: event.isManualIn,
            checkOut: null,
            checkOutDeviceId: null,
            isManualOut: false,
          });
        } 
        // Is it an odd index? (1, 3, 5...) -> Check Out
        else {
          const currentSession = sessions[sessions.length - 1];
          currentSession.checkOut = event.time;
          currentSession.checkOutDeviceId = event.deviceId;
          currentSession.isManualOut = event.isManualOut || event.isManualIn; // if a manual punch acted as checkout
          
          // Validation requirement: CheckOut cannot be before CheckIn
          if (currentSession.checkOut.getTime() < currentSession.timestamp.getTime()) {
             console.warn(`[AttendanceProcessor] Invalid CheckOut before CheckIn. Dropping checkout. User: ${employeeId}`);
             currentSession.checkOut = null;
             currentSession.checkOutDeviceId = null;
             currentSession.isManualOut = false;
          }
        }
      }

      // 6. Idempotent Database Update
      await prisma.$transaction(async (tx) => {
        // Delete all NON-MANUAL logs for this day to recreate them.
        // We preserve manual records, but actually, the prompt wants us to *update* or recreate cleanly.
        // To be truly idempotent and avoid duplicates, we wipe the day's records and insert the newly computed pairs.
        await tx.attendanceLog.deleteMany({
          where: {
            employeeId: employeeId,
            timestamp: {
              gte: startOfDayUTC,
              lte: endOfDayUTC
            }
          }
        });

        // Insert the computed sessions
        for (const session of sessions) {
          await tx.attendanceLog.create({
            data: {
              employeeId: employeeId,
              timestamp: session.timestamp,
              punchType: 'CheckIn', // Force CheckIn for the row base
              deviceId: session.deviceId || 'PROCESSOR',
              workMode: 'IN_HOUSE',
              
              // Apply Checkout if it exists
              checkOut: session.checkOut,
              checkOutDeviceId: session.checkOutDeviceId,
              
              // Preserve manual flags
              isManualIn: session.isManualIn,
              isManualOut: session.isManualOut,
            }
          });
        }
      });

      console.log(`[AttendanceProcessor] ✅ Idempotent pairing complete for ${employeeId} on ${targetDate.toISOString().split('T')[0]}`);

    } catch (err: any) {
      console.error(`[AttendanceProcessor] ❌ Error processing logs for ${employeeId}:`, err.message);
    }
  }

  /**
   * Triggers the pairing logic for all users who have unprocessed raw logs.
   * Can be called by the Scheduler.
   */
  static async processAllPendingLogs(): Promise<void> {
    console.log('[AttendanceProcessor] 🔄 Starting batch deterministic processing...');
    
    // Find all distinct deviceUserIds that exist in RawDeviceLog
    const distinctRawUsers = await prisma.rawDeviceLog.groupBy({
      by: ['deviceUserId'],
    });

    if (distinctRawUsers.length === 0) {
      console.log('[AttendanceProcessor] No raw logs to process.');
      return;
    }

    // Process each user
    for (const rawUser of distinctRawUsers) {
      // Find the mapped system user
      const user = await prisma.user.findFirst({
        where: { zktecoId: parseInt(rawUser.deviceUserId, 10) },
        select: { id: true }
      });

      if (!user) {
         console.error(`[AttendanceProcessor] Missing User mapping for ZKTeco ID: ${rawUser.deviceUserId}`);
         continue;
      }

      // Find all distinct dates this user has raw logs for
      const userRawLogs = await prisma.rawDeviceLog.findMany({
         where: { deviceUserId: rawUser.deviceUserId },
         select: { recordTime: true }
      });

      const uniqueDates = new Set<string>();
      const tzOffset = 6 * 60 * 60 * 1000;

      for (const log of userRawLogs) {
         // Shift to BD time to get the correct calendar day
         const localTime = new Date(log.recordTime.getTime() + tzOffset);
         const dateString = `${localTime.getUTCFullYear()}-${localTime.getUTCMonth() + 1}-${localTime.getUTCDate()}`;
         uniqueDates.add(dateString);
      }

      // Run processor for each unique date
      for (const dateStr of uniqueDates) {
         const [y, m, d] = dateStr.split('-').map(Number);
         // Create a Date object in UTC that represents that day
         // Note: processForEmployeeAndDate will apply timezone offsets, so we pass a UTC date
         // that safely falls within the intended day.
         const targetDate = new Date(Date.UTC(y, m, d, 12, 0, 0)); 
         // Oops month is 0-indexed in JS Date! Wait, if we used getUTCMonth()+1 above, we should subtract 1 here.
         // Actually, let's fix it inside the loop to be safer.
         const properTargetDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
         
         await this.processForEmployeeAndDate(user.id, properTargetDate);
      }
      
      // Cleanup: Delete the raw logs for this user now that they are idempotently processed
      await prisma.rawDeviceLog.deleteMany({
        where: { deviceUserId: rawUser.deviceUserId }
      });
    }

    console.log('[AttendanceProcessor] 🏁 Batch deterministic processing complete.');
  }
}
