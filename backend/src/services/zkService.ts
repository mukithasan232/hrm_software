// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';

// ─── Device Configuration ──────────────────────────────────────────────────────
const ZK_IP      = process.env.ZK_DEVICE_IP   || '192.168.10.185';
const ZK_PORT    = parseInt(process.env.ZK_DEVICE_PORT || '4370');
const ZK_TIMEOUT = 40000; // Increased to 40s to prevent TIMEOUT_ON_WRITING_MESSAGE
const ZK_INPORT  = 0; // Set to 0 to allow OS to pick an available port and avoid conflicts
const ZK_PASSWORD = parseInt(process.env.ZK_COMM_KEY || '0');

// ─── Error Classification ──────────────────────────────────────────────────────
function classifyError(err: any): string {
  console.error('[ZKService] Raw Error:', err);
  const msg: string = (err?.message || '').toLowerCase();
  if (msg.includes('econnrefused'))                       return 'Connection refused — device offline or wrong port.';
  if (msg.includes('etimedout') || msg.includes('timeout')) return 'Connection timed out — device unreachable on the network.';
  if (msg.includes('enotfound'))                          return 'Host not found — check the IP address.';
  if (msg.includes('subarray') || msg.includes('null'))   return 'Device returned an unreadable packet. Check firmware compatibility.';
  return err?.message || 'Unknown ZKTeco device error.';
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
    case 0:  return 'CheckIn';
    case 1:  return 'CheckOut';
    case 2:  return 'BreakOut';
    case 3:  return 'BreakIn';
    case 4:  return 'OvertimeIn';
    case 5:  return 'OvertimeOut';
    default: return 'Unknown';
  }
}

/**
 * Resolves the punch type with a fallback. If the device state is not reliable
 * (e.g. always returns CheckOut), we check if a CheckIn exists for today.
 * If no CheckIn exists, this first punch of the day is mapped as CheckIn.
 * Subsequent punches are mapped as CheckOut.
 */
export async function resolvePunchType(employeeId: string, timestamp: Date, deviceState: any): Promise<string> {
  const devicePunchType = getPunchType(deviceState);

  // If the device is sending specific break or overtime states, preserve them
  if (['BreakOut', 'BreakIn', 'OvertimeIn', 'OvertimeOut'].includes(devicePunchType)) {
    return devicePunchType;
  }

  // Otherwise, apply fallback logic for CheckIn, CheckOut, or Unknown states
  const tzOffset = 6 * 60 * 60 * 1000; // GMT+6
  const localDateStr = new Date(timestamp.getTime() + tzOffset).toISOString().split('T')[0];
  const startOfDay = new Date(`${localDateStr}T00:00:00+06:00`);
  const endOfDay = new Date(`${localDateStr}T23:59:59.999+06:00`);

  const existingCheckIn = await prisma.attendanceLog.findFirst({
    where: {
      employeeId,
      timestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
      punchType: 'CheckIn',
    },
  });

  if (!existingCheckIn) {
    return 'CheckIn';
  }

  return 'CheckOut';
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
    
    if (rawLogs.length === 0) {
      return { synced: 0, skipped: 0, total: 0 };
    }
    console.log(`[ZKService] 📋 ${rawLogs.length} raw record(s) from device.`);

    let synced = 0;
    let skipped = 0;

    // Process in chunks of 100 for better performance
    const chunkSize = 100;
    for (let i = 0; i < rawLogs.length; i += chunkSize) {
      const chunk = rawLogs.slice(i, i + chunkSize);
      
      const results = await Promise.all(chunk.map(async (log: any) => {
        try {
          const employeeId = String(log.user_id);
          const timestamp = new Date(log.record_time);

          if (isNaN(timestamp.getTime())) return { success: false, skipped: true };

          const stateValue = log.state !== undefined && log.state !== null ? log.state : (log.type !== undefined && log.type !== null ? log.type : -1);
          const punchType = await resolvePunchType(employeeId, timestamp, stateValue);

          await prisma.attendanceLog.upsert({
            where: {
              employeeId_timestamp: {
                employeeId,
                timestamp,
              },
            },
            update: {},
            create: {
              employeeId,
              timestamp,
              punchType: punchType as any,
              deviceId: ZK_IP,
            },
          });
          return { success: true };
        } catch (err) {
          return { success: false };
        }
      }));

      synced += results.filter(r => r.success).length;
      skipped += results.filter(r => !r.success).length;
      console.log(`[ZKService] Chunks progress: ${Math.min(i + chunkSize, rawLogs.length)}/${rawLogs.length}`);
    }

    console.log(`[ZKService] ✔  Synced: ${synced} | Total: ${rawLogs.length}`);
    return { synced, skipped, total: rawLogs.length };
  } catch (err: any) {
    const reason = classifyError(err);
    console.error(`[ZKService] ❌ ${reason}`);
    throw new Error(reason);
  } finally {
    try { await zk.disconnect(); } catch (_) {}
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
      userId: u.user_id,
      name: u.name,
      role: u.role
    }));
    console.log(`[ZKService] 👥 ${users.length} user(s) on device.`);
    return users;
  } catch (err: any) {
    throw new Error(classifyError(err));
  } finally {
    try { await zk.disconnect(); } catch (_) {}
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
    try { await zk.disconnect(); } catch (_) {}
  }
};

/** Legacy alias */
export const fetchDeviceLogs = async (): Promise<number> => {
  const { synced } = await getDeviceAttendance();
  return synced;
};
