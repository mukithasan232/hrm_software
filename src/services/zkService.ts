// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';

// ─── Device Configuration ──────────────────────────────────────────────────────
const ZK_IP = process.env.ZK_DEVICE_IP || '192.168.10.185';
const ZK_PORT = parseInt(process.env.ZK_DEVICE_PORT || '4370');
const ZK_TIMEOUT = 40000; // Increased to 40s to prevent TIMEOUT_ON_WRITING_MESSAGE
const ZK_INPORT = 0; // Set to 0 to allow OS to pick an available port and avoid conflicts
const ZK_PASSWORD = parseInt(process.env.ZK_COMM_KEY || '0');

// ─── Error Classification ──────────────────────────────────────────────────────
function classifyError(err: any): string {
  console.error('[ZKService] Raw Error:', err);
  const errorStr: string = typeof err === 'string' ? err : (err?.message || err?.toString() || '');
  const msg = errorStr.toLowerCase();
  if (msg.includes('econnrefused')) return 'Connection refused — device offline or wrong port.';
  if (msg.includes('etimedout') || msg.includes('timeout')) return 'Connection timed out — device unreachable on the network.';
  if (msg.includes('enotfound')) return 'Host not found — check the IP address.';
  if (msg.includes('subarray') || msg.includes('null')) return 'Device returned an unreadable packet. Check firmware compatibility.';
  return errorStr || 'Unknown ZKTeco device error.';
}

// ─── Factory ──────────────────────────────────────────────────────────────────
function createZK(): InstanceType<typeof ZKLib> {
  const zk = new ZKLib(ZK_IP, ZK_PORT, ZK_TIMEOUT, ZK_INPORT);
  zk.password = ZK_PASSWORD; // Using env key (default 0)
  zk.connectionType = 'udp';  // Switching back to UDP as it is more standard for ZKTeco K60

  return zk;
}

// ─── Punch type resolver ───────────────────────────────────────────────────────
export function getPunchType(state: any): string {
  const numericState = typeof state === 'number' ? state : parseInt(state, 10);
  switch (numericState) {
    case 0: return 'CheckIn';
    case 1: return 'CheckOut';
    case 2: return 'BreakOut';
    case 3: return 'BreakIn';
    case 4: return 'OvertimeIn';
    case 5: return 'OvertimeOut';
    default: return 'Unknown';
  }
}

/**
 * Resolves the punch type with a fallback. If the device state is not reliable
 * (e.g. always returns CheckOut), we check if a CheckIn exists for today.
 * If no CheckIn exists, this first punch of the day is mapped as CheckIn.
 * Subsequent punches are mapped as CheckOut.
 */
export async function resolvePunchType(
  employeeId: string,
  timestamp: Date,
  deviceState: any,
  processedEmpDays?: Set<string>
): Promise<string> {
  const devicePunchType = getPunchType(deviceState);

  // If the device is sending specific break or overtime states, preserve them
  if (['BreakOut', 'BreakIn', 'OvertimeIn', 'OvertimeOut'].includes(devicePunchType)) {
    return devicePunchType;
  }

  // Otherwise, apply smart inference logic for CheckIn/CheckOut
  const tzOffset = 6 * 60 * 60 * 1000; // GMT+6
  const localDateStr = new Date(timestamp.getTime() + tzOffset).toISOString().split('T')[0];

  const cacheKey = `${employeeId}:${localDateStr}`;

  // If processedEmpDays cache is provided (for bulk imports), use it exclusively
  if (processedEmpDays) {
    if (processedEmpDays.has(cacheKey)) {
      return 'CheckOut';
    } else {
      processedEmpDays.add(cacheKey);
      return 'CheckIn';
    }
  }

  // Fallback for single real-time punch logic (e.g. from websocket socket hook)
  const startOfDay = new Date(`${localDateStr}T00:00:00+06:00`);
  const endOfDay = new Date(`${localDateStr}T23:59:59.999+06:00`);

  const count = await prisma.attendanceLog.count({
    where: {
      employeeId,
      timestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (count === 0) {
    return 'CheckIn';
  }

  return 'CheckOut';
}

/**
 * Self-healing routine to group today's logs by employeeId,
 * sort them by timestamp ascending, and strictly update the
 * earliest log to CheckIn and subsequent logs to CheckOut.
 */
export async function healTodaysData(): Promise<void> {
  try {
    const tzOffset = 6 * 60 * 60 * 1000;
    const nowBD = new Date(new Date().getTime() + tzOffset);
    const year = nowBD.getUTCFullYear();
    const month = nowBD.getUTCMonth();
    const date = nowBD.getUTCDate();

    const startOfToday = new Date(Date.UTC(year, month, date - 1, 18, 0, 0, 0));
    const endOfToday = new Date(Date.UTC(year, month, date, 17, 59, 59, 999));

    // 1. Fetch all attendance logs for today
    const logs = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // 2. Group by employeeId
    const employeeLogs: Record<string, typeof logs> = {};
    for (const log of logs) {
      if (!employeeLogs[log.employeeId]) {
        employeeLogs[log.employeeId] = [];
      }
      employeeLogs[log.employeeId].push(log);
    }

    // 3. Update punchTypes: Earliest -> CheckIn, Rest -> CheckOut
    for (const employeeId in employeeLogs) {
      const list = employeeLogs[employeeId];
      if (list.length === 0) continue;

      // First log of the day becomes CheckIn
      const firstLog = list[0];
      await prisma.attendanceLog.update({
        where: { id: firstLog.id },
        data: { punchType: 'CheckIn' },
      });

      // Subsequent logs of the day become CheckOut (unless they are break or overtime)
      for (let i = 1; i < list.length; i++) {
        const log = list[i];
        if (['CheckIn', 'CheckOut', 'Unknown'].includes(log.punchType)) {
          await prisma.attendanceLog.update({
            where: { id: log.id },
            data: { punchType: 'CheckOut' },
          });
        }
      }
    }
    console.log(`[zkService] 🏥 Healed today's attendance data for ${Object.keys(employeeLogs).length} employees.`);
  } catch (err: any) {
    console.error('❌ [healTodaysData] Error healing today\'s logs:', err);
  }
}

// ─── Connection Helper ────────────────────────────────────────────────────────
async function connectProperly(zk: any): Promise<void> {
  // Use appropriate socket creation based on protocol
  if (zk.connectionType === 'udp') {
    await zk.createSocket();
  } else {
    await zk.zudp.createSocket();
  }

  // Give the socket a moment to breathe
  await new Promise(r => setTimeout(r, 1000));

  await zk.connect();
  console.log(`[ZKService] 🔌 Connected using ${zk.connectionType.toUpperCase()}`);

  // Log real-time logs to catch punches as they happen
  zk.getRealTimeLogs((data: any) => {
    console.log('[ZKService] 🕒 Real-time Log Received:', data);
  });
}

/**
 * Robust wrapper for fetching attendance with retry logic
 */
async function getAttendanceAsync(zk: any): Promise<any[]> {
  let attempts = 3;
  while (attempts > 0) {
    try {
      const response = await zk.getAttendances();
      console.log('[ZKService] 🔍 Raw Attendance Response:', JSON.stringify(response, null, 2));
      const { data } = response;
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      const isTimeout = (err.message || '').includes('TIMEOUT');
      if (isTimeout && attempts > 1) {
        console.warn(`[ZKService] ⏳ Timeout detected. Retrying... (${attempts - 1} left)`);
        await new Promise(r => setTimeout(r, 3000)); // Wait 3s before retry
        attempts--;
        continue;
      }

      if (err.message === 'zero' || err.message === 'zero length reply') {
        console.log("[ZKService] ⚠️ ডিভাইস থেকে কোনো ডেটা পাওয়া যায়নি (Empty logs).");
        return [];
      }
      throw err;
    }
  }
  return [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch attendance logs from device → upsert into MongoDB.
 */
export const getDeviceAttendance = async (): Promise<{ synced: number; skipped: number; total: number }> => {
  const zk = createZK();
  try {
    await connectProperly(zk);
    console.log(`[ZKService] ✅ Connected to ${ZK_IP}:${ZK_PORT} (${zk.connectionType})`);

    const rawLogs = await getAttendanceAsync(zk);

    // Clear today's logs for fresh start before sync
    const tzOffset = 6 * 60 * 60 * 1000; // GMT+6
    const nowBD = new Date(new Date().getTime() + tzOffset);
    const year = nowBD.getUTCFullYear();
    const month = nowBD.getUTCMonth();
    const date = nowBD.getUTCDate();

    const startOfToday = new Date(Date.UTC(year, month, date - 1, 18, 0, 0, 0));
    const endOfToday = new Date(Date.UTC(year, month, date, 17, 59, 59, 999));

    console.log(`[ZKService] 🗑️ Deleting today's logs for clean slate: ${startOfToday.toISOString()} to ${endOfToday.toISOString()}`);
    await prisma.attendanceLog.deleteMany({
      where: {
        timestamp: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    if (rawLogs.length === 0) {
      return { synced: 0, skipped: 0, total: 0 };
    }
    console.log(`[ZKService] 📋 ${rawLogs.length} raw record(s) from device.`);

    // Sort logs chronologically ascending (earliest to latest) to guarantee correct CheckIn/CheckOut determination
    const sortedRawLogs = Array.isArray(rawLogs) ? [...rawLogs].sort((a: any, b: any) => new Date(a.record_time).getTime() - new Date(b.record_time).getTime()) : [];

    let synced = 0;
    let skipped = 0;
    const processedEmpDays = new Set<string>();

    // Process in chunks of 100 for better performance
    const chunkSize = 100;
    for (let i = 0; i < sortedRawLogs.length; i += chunkSize) {
      const chunk = sortedRawLogs.slice(i, i + chunkSize);

      for (const log of chunk) {
        try {
          const employeeId = String(log.user_id ?? log.userId ?? log.uid);
          const timestamp = new Date(log.record_time);

          if (isNaN(timestamp.getTime())) {
            skipped++;
            continue;
          }

          const stateValue = log.state !== undefined && log.state !== null ? log.state : (log.type !== undefined && log.type !== null ? log.type : -1);
          const punchType = await resolvePunchType(employeeId, timestamp, stateValue, processedEmpDays);

          await prisma.attendanceLog.upsert({
            where: {
              employeeId_timestamp: {
                employeeId,
                timestamp,
              },
            },
            update: {
              punchType: punchType as any
            },
            create: {
              employeeId,
              timestamp,
              punchType: punchType as any,
              deviceId: ZK_IP,
            },
          });
          synced++;
        } catch (err) {
          skipped++;
        }
      }

      console.log(`[ZKService] Chunks progress: ${Math.min(i + chunkSize, sortedRawLogs.length)}/${sortedRawLogs.length}`);
    }

    console.log(`[ZKService] ✔  Synced: ${synced} | Total: ${sortedRawLogs.length}`);

    // Automatically self-heal today's attendance logs to guarantee earliest = CheckIn, latest = CheckOut
    await healTodaysData();

    return { synced, skipped, total: rawLogs.length };
  } catch (err: any) {
    const reason = classifyError(err);
    console.error(`[ZKService] ❌ ${reason}`);
    throw new Error(reason);
  } finally {
    try { await zk.disconnect(); } catch (_) { }
  }
};

/**
 * Fetch all users stored on the device.
 */
export const getDeviceUsers = async (): Promise<any[]> => {
  const zk = createZK();
  try {
    await connectProperly(zk);
    const response = await zk.getUsers();
    console.log('[ZKService] 🔍 Raw Users Response:', JSON.stringify(response, null, 2));
    const { data } = response;
    // zkteco-js returns users as { user_id, name, cardno, role, password, ... }
    const users: any[] = (data ?? []).map((u: any) => ({
      userId: String(u.user_id ?? u.userId ?? u.uid),
      name: u.name,
      role: u.role
    }));
    console.log(`[ZKService] 👥 ${users.length} user(s) on device.`);
    return users;
  } catch (err: any) {
    throw new Error(classifyError(err));
  } finally {
    try { await zk.disconnect(); } catch (_) { }
  }
};

/**
 * Non-destructive ping — verifies connectivity.
 */
export const pingDevice = async (): Promise<{ reachable: boolean; info?: any; error?: string; connectionType?: string }> => {
  const zk = createZK();
  try {
    await connectProperly(zk);
    return { reachable: true, connectionType: zk.connectionType };
  } catch (err: any) {
    return { reachable: false, error: classifyError(err) };
  } finally {
    try { await zk.disconnect(); } catch (_) { }
  }
};

/** Legacy alias */
export const fetchDeviceLogs = async (): Promise<number> => {
  const { synced } = await getDeviceAttendance();
  return synced;
};
