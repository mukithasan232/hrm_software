// @ts-ignore
import ZKLib from 'zkteco-js';
import { AttendanceLog } from '../models/AttendanceLog';
import { User } from '../models/User';

// ─── Device Configuration ──────────────────────────────────────────────────────
const ZK_IP      = process.env.ZK_DEVICE_IP   || '192.168.10.185';
const ZK_PORT    = parseInt(process.env.ZK_DEVICE_PORT || '4370');
const ZK_TIMEOUT = 10000;
const ZK_INPORT  = 5200; 

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
  zk.connectionType = 'udp';
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
  // We use UDP because TCP was timing out/crashing with this device
  await zk.zudp.createSocket();
  await zk.zudp.connect();
  zk.connectionType = 'udp';
}

/**
 * Robust wrapper for fetching attendance
 */
async function getAttendanceAsync(zk: any): Promise<any[]> {
  try {
    const { data } = await zk.getAttendances();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    if (err.message === 'zero' || err.message === 'zero length reply') {
      console.log("[ZKService] ⚠️ ডিভাইস থেকে কোনো ডেটা পাওয়া যায়নি (Empty logs).");
      return [];
    }
    throw err;
  }
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
    const { data } = await zk.getUsers();
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
