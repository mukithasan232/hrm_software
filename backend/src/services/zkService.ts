// @ts-ignore
import ZKLib from 'zkteco-js';
import { AttendanceLog } from '../models/AttendanceLog';
import { User } from '../models/User';

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
function resolvePunchType(type: number): 'CheckIn' | 'CheckOut' | 'Unknown' {
  if (type === 0) return 'CheckIn';
  if (type === 1) return 'CheckOut';
  return 'Unknown';
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

    let synced = 0, skipped = 0;

    for (const log of rawLogs) {
      try {
        // zkteco-js returns { user_id, record_time, type, state }
        const employeeId = String(log.user_id);
        const timestamp = new Date(log.record_time);

        if (isNaN(timestamp.getTime())) {
          console.warn(`[ZKService] ⚠️ Invalid date for user ${employeeId}:`, log.record_time);
          skipped++;
          continue;
        }

        await AttendanceLog.create({
          employeeId,
          timestamp,
          punchType:  resolvePunchType(log.type ?? -1),
          deviceId:   ZK_IP,
        });
        synced++;
      } catch (err: any) {
        if (err.code === 11000) skipped++;
        else console.error('[ZKService] Insert error:', err.message);
      }
    }

    console.log(`[ZKService] ✔  Synced: ${synced} | Skipped (dup): ${skipped}`);
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
