// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

// ─── Device Configuration ──────────────────────────────────────────────────────
// Configuration values are loaded dynamically in the functions to avoid Next.js build crashes.
const ZK_TIMEOUT = 40000; // Increased to 40s to prevent TIMEOUT_ON_WRITING_MESSAGE
const ZK_INPORT = 0; // Set to 0 to allow OS to pick an available port and avoid conflicts

// ─── Timezone Fix ─────────────────────────────────────────────────────────────
// The ZKTeco device sends timestamps in local Bangladesh time (UTC+6).
// JavaScript's `new Date(localTimeString)` treats a bare date string as UTC
// (or server-local time), which would make every punch appear 6 hours ahead
// of its true UTC equivalent.
// To fix: parse the device time as a Date, then subtract 6 hours to get the
// correct UTC moment before saving to Prisma.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6 in milliseconds
// Replaces volatile server-timezone-dependent subtraction logic with exact numeric component parsing.
// Milliseconds are explicitly zeroed so that @@unique([employeeId, timestamp]) works correctly:
// two network packets for the same punch arriving at 10:19:18.123 and 10:19:18.456 both
// normalize to 10:19:18.000 and are treated as one record by skipDuplicates/upsert.
export const parseDeviceTime = (deviceDate: Date): Date => {
  const y = deviceDate.getFullYear();
  const m = String(deviceDate.getMonth() + 1).padStart(2, '0');
  const d = String(deviceDate.getDate()).padStart(2, '0');
  const h = String(deviceDate.getHours()).padStart(2, '0');
  const min = String(deviceDate.getMinutes()).padStart(2, '0');
  const s = String(deviceDate.getSeconds()).padStart(2, '0');
  // Build ISO string with +06:00 offset (device sends Dhaka local time)
  // The string intentionally omits milliseconds so the result is always .000
  const normalized = new Date(`${y}-${m}-${d}T${h}:${min}:${s}+06:00`);
  return normalized; // milliseconds = 0 by construction
};

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
  const ZK_IP = process.env.ZK_DEVICE_IP;
  if (!ZK_IP) {
    throw new Error('Environment variable ZK_DEVICE_IP is required for ZKTeco integration');
  }
  const ZK_PORT_STR = process.env.ZK_DEVICE_PORT;
  if (!ZK_PORT_STR) {
    throw new Error('Environment variable ZK_DEVICE_PORT is required for ZKTeco integration');
  }
  const ZK_PORT = parseInt(ZK_PORT_STR);
  const ZK_PASSWORD = parseInt(process.env.ZK_COMM_KEY || '0');

  const zk = new ZKLib(ZK_IP, ZK_PORT, ZK_TIMEOUT, ZK_INPORT);
  zk.password = ZK_PASSWORD;
  zk.connectionType = 'tcp'; // Prioritize TCP for stable payloads
  return zk;
}

// ─── Punch type resolver ───────────────────────────────────────────────────────
export function getPunchType(record: any): string {
  const punchType = (record.state === 0 || record.type === 0) ? 'CheckIn' : 'CheckOut';
  return punchType;
}

/**
 * Resolves the punch type chronologically, ignoring device state completely.
 *
 * Rules:
 *  - BULK SYNC path (punchHistory provided): uses an in-memory per-employee
 *    punch counter. Odd punch = CheckIn, Even punch = CheckOut.
 *    No time-gap filtering — every distinct device record is saved.
 *
 *  - REAL-TIME path (no punchHistory): queries the DB for today’s existing
 *    logs. Odd total = next is CheckOut, Even total = next is CheckIn.
 *    Only exact-same-second duplicates are blocked (handled by DB unique
 *    constraint + upsert in the caller). No 30-minute guard.
 */
export async function resolvePunchType(
  employeeId: string,
  timestamp: Date,
  log: any,
  punchHistory?: Map<string, { count: number; lastPunch: Date }>
): Promise<string | null> {
  const tzOffset = 6 * 60 * 60 * 1000;
  const localDate = new Date(timestamp.getTime() + tzOffset);
  const dateStr = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth() + 1}-${localDate.getUTCDate()}`;
  const key = `${employeeId}_${dateStr}`;

  if (punchHistory) {
    // ── BULK SYNC PATH ──────────────────────────────────────────────────────
    if (!punchHistory.has(key)) {
      punchHistory.set(key, { count: 1, lastPunch: timestamp });
      return 'CheckIn';
    } else {
      const history = punchHistory.get(key)!;

      // Block EXACT same-second duplicates from the device only
      if (timestamp.getTime() === history.lastPunch.getTime()) {
        return null; // identical record — skip
      }

      history.count++;
      history.lastPunch = timestamp;
      // Odd count = CheckIn, Even count = CheckOut
      return history.count % 2 === 1 ? 'CheckIn' : 'CheckOut';
    }
  }

  // ── REAL-TIME PATH ────────────────────────────────────────────────────────
  // Query DB for today’s existing logs for this employee (device logs only)
  const startOfDayLocal = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 0, 0, 0, 0));
  const endOfDayLocal = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 23, 59, 59, 999));

  const startOfTodayUTC = new Date(startOfDayLocal.getTime() - tzOffset);
  const endOfTodayUTC = new Date(endOfDayLocal.getTime() - tzOffset);

  const existingLogs = await prisma.attendanceLog.findMany({
    where: {
      employeeId,
      deviceId: { not: 'Manual Entry' }, // Never count manual entries in the alternation
      timestamp: {
        gte: startOfTodayUTC,
        lte: endOfTodayUTC,
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Block exact same-second duplicate from device
  const lastLog = existingLogs[existingLogs.length - 1];
  if (lastLog && timestamp.getTime() === lastLog.timestamp.getTime()) {
    return null; // exact duplicate — DB upsert will handle idempotency
  }

  // Odd existing count = next is CheckOut, Even (or zero) = next is CheckIn
  const nextCount = existingLogs.length + 1;
  return nextCount % 2 === 1 ? 'CheckIn' : 'CheckOut';
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
    const startBD = new Date(Date.UTC(nowBD.getUTCFullYear(), nowBD.getUTCMonth(), nowBD.getUTCDate(), 0, 0, 0, 0));
    const endBD = new Date(Date.UTC(nowBD.getUTCFullYear(), nowBD.getUTCMonth(), nowBD.getUTCDate(), 23, 59, 59, 999));

    const startOfToday = new Date(startBD.getTime() - tzOffset);
    const endOfToday = new Date(endBD.getTime() - tzOffset);

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
        if (['CheckIn', 'CheckOut'].includes(log.punchType)) {
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

// ─── Connection Helper ─────────────────────────────────────────────────────────────────
async function connectProperly(zk: any): Promise<void> {
  // Try TCP first
  try {
    zk.connectionType = 'tcp';
    if (zk.ztcp && typeof zk.ztcp.createSocket === 'function') {
      await zk.ztcp.createSocket();
    } else {
      await zk.createSocket();
    }
  } catch (err) {
    console.warn('[ZKService] TCP connection failed, falling back to UDP...');
    zk.connectionType = 'udp';
    if (zk.zudp && typeof zk.zudp.createSocket === 'function') {
      await zk.zudp.createSocket();
    } else {
      await zk.createSocket();
    }
  }

  // Give the socket a moment to breathe
  await new Promise(r => setTimeout(r, 1000));

  try {
    // Only call connect() if it actually exists in the library version
    if (typeof zk.connect === 'function') {
      await Promise.race([
        zk.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout - device unreachable')), 5000))
      ]);
    }
    console.log(`[ZKService] 🔌 Connected using ${zk.connectionType.toUpperCase()}`);

    if (typeof zk.getRealTimeLogs === 'function') {
      zk.getRealTimeLogs((data: any) => {
        console.log('[ZKService] 🕒 Real-time Log Received:', data);
      });
    }
  } catch (error: any) {
    console.error('[ZKTeco Connection Error]:', error.message);
    throw error;
  }
}

// ─── Helper to fetch raw users directly ───────────────────────────────────────
async function getDeviceUsersRaw(zk: any): Promise<any[]> {
  try {
    const response = await zk.getUsers();
    console.log(`[ZKService] 🔍 Raw Users Response (${zk.connectionType.toUpperCase()}):`, JSON.stringify(response, null, 2));
    const { data } = response;
    const users = Array.isArray(data) ? data : [];

    // K60 firmware quirk: UDP sometimes returns empty user list even when users exist.
    // TCP fallback disabled as the device only supports UDP port 4370.
    if (users.length === 0 && zk.connectionType === 'udp') {
      console.warn('[ZKService] ⚠️ UDP returned 0 users. TCP fallback disabled due to UDP-only connectivity.');
    }

    return users;
  } catch (err) {
    console.warn('[ZKService] ⚠️ Failed to fetch users from device:', err);
    return [];
  }
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

let hasSanitizedManualLogs = false;

/**
 * Fetch attendance logs from device → upsert into MongoDB.
 */
export const getDeviceAttendance = async (): Promise<{ synced: number; skipped: number; total: number }> => {
  const zk = createZK();
  const currentZkIp = process.env.ZK_DEVICE_IP || 'Unknown IP';
  try {
    await connectProperly(zk);
    console.log(`[ZKService] ✅ Connected to ${currentZkIp} (${zk.connectionType})`);

    // Data sanitization logic has been removed as the root timezone bug is permanently resolved.

    // 1. Fetch Users from device (Mapping Phase)
    // Removed auto-upsert to enforce strict Hardware-to-Software mapping
    console.log('[ZKService] 👥 Fetching users from device for mapping...');
    const rawUsers = await getDeviceUsersRaw(zk);
    const userIdMap = new Map<string, string>(); // maps device employeeId -> User.id (UUID)

    // Load any other existing users in database into the userIdMap
    const dbUsers = await prisma.user.findMany({});
    for (const user of dbUsers) {
      userIdMap.set(user.employeeId, user.id);
    }

    const rawLogs = await getAttendanceAsync(zk);



    // TASK 1: Implement In-Memory Date Filtering
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentLogs = rawLogs.filter((log: any) => {
      const logDate = new Date(log.recordTime || log.record_time);
      return logDate >= fourteenDaysAgo;
    });

    if (recentLogs.length === 0) {
      // Emit socket event to frontend via global.io
      const io = (global as any).io;
      if (io) {
        io.emit('attendanceUpdate', { checkIn: true });
      }
      return { synced: 0, skipped: 0, total: 0 };
    }
    console.log(`[ZKService] 📋 ${recentLogs.length} recent record(s) from device after filtering.`);

    // Sort logs chronologically ascending (earliest to latest) to guarantee correct CheckIn/CheckOut determination
    const sortedRawLogs = Array.isArray(recentLogs) ? [...recentLogs].sort((a: any, b: any) => new Date(a.recordTime || a.record_time).getTime() - new Date(b.recordTime || b.record_time).getTime()) : [];

    let skipped = 0;
    const punchHistory = new Map<string, { count: number; lastPunch: Date }>();

    // REMOVED: Auto-Creation of Fallback Unmapped User. Strict Opt-in Architecture.
    // Track timestamps globally to prevent duplicate compound constraints on exact millisecond
    const usedTimestamps = new Set<string>();
    const formattedLogsArray: any[] = [];

    for (const log of sortedRawLogs) {
      try {
        const deviceEmpId = String(log.deviceUserId ?? log.user_id ?? log.userId ?? log.uid);

        // parseDeviceTime converts device-local Dhaka time → UTC and strips milliseconds.
        // The defensive setMilliseconds(0) below is a belt-and-suspenders guard: if any
        // future code path introduces sub-second jitter, it is zeroed here before the
        // @@unique([employeeId, timestamp]) constraint and createMany deduplicate on it.
        const rawTimestamp = parseDeviceTime(new Date(log.recordTime || log.record_time));
        if (rawTimestamp.getMilliseconds() !== 0) {
          console.warn(`[ZKService] ⚠️ Non-zero ms detected (${rawTimestamp.getMilliseconds()}ms) — stripping. Raw: ${log.recordTime || log.record_time}`);
        }
        rawTimestamp.setMilliseconds(0);
        const timestamp = rawTimestamp;

        if (isNaN(timestamp.getTime())) {
          skipped++;
          continue;
        }

        // Map deviceEmpId (e.g. "5") to the actual DB User's UUID
        let employeeId = userIdMap.get(deviceEmpId);
        if (!employeeId) {
          // STRICT OPT-IN: Skip unmapped device users entirely
          skipped++;
          continue;
        }

        const punchType = await resolvePunchType(employeeId, timestamp, log, punchHistory);

        if (!punchType) {
          skipped++;
          continue; // Exact-second duplicate — skipped by in-memory Set below
        }

        // In-memory dedup: last line of defence before createMany (skipDuplicates:true
        // in createMany + the DB unique constraint are the authoritative dedup).
        const collisionKey = `${employeeId}_${timestamp.getTime()}`;
        if (usedTimestamps.has(collisionKey)) {
          skipped++;
          continue;
        }
        usedTimestamps.add(collisionKey);

        formattedLogsArray.push({
          employeeId,
          timestamp,
          punchType: punchType as any,
          deviceId: currentZkIp,
        });

      } catch (err: any) {
        console.error(`[ZKService] ❌ Failed to format log:`, err.message);
        skipped++;
      }
    }

    // TASK 2: Convert to Bulk Insert (createMany)
    let synced = 0;
    if (formattedLogsArray.length > 0) {
      const result = await prisma.attendanceLog.createMany({
        data: formattedLogsArray,
        skipDuplicates: true, // Automatically ignores records that violate the Unique Constraint
      });
      synced = result.count;
    }

    console.log(`[ZKService] ✔  Synced: ${synced} | Skipped: ${skipped} | Total Recent: ${sortedRawLogs.length}`);

    // Emit socket event to frontend via global.io for instant dashboard refresh
    const io = (global as any).io;
    if (io) {
      io.emit('attendanceUpdate', { synced, skipped });
      console.log('[ZKService] 📡 Emitted attendanceUpdate to frontend.');
    }

    return { synced, skipped, total: rawLogs.length };
  } catch (err: any) {
    const reason = classifyError(err);
    console.error(`[ZKService] ❌ ${reason}`);
    throw new Error(reason);
  } finally {
    try {
      if (zk && (zk.socket || (zk.zudp && zk.zudp.socket) || (zk.ztcp && zk.ztcp.socket))) {
        if (typeof zk.disconnect === 'function') {
          await zk.disconnect();
        } else if (typeof zk.free === 'function') {
          await zk.free();
        }
      }
    } catch (err: any) {
      console.error('[ZKService] ❌ Cleanup failed:', err.message);
    }
  }
};

/**
 * Fetch all users stored on the device and sync them to database.
 * Forced UDP because the device only supports UDP on port 4370.
 */
export const getDeviceUsers = async (): Promise<any[]> => {
  const zk = createZK();
  try {
    await connectProperly(zk);
    const response = await zk.getUsers();
    console.log('[ZKService] 🔍 Raw Users Response (TCP):', JSON.stringify(response, null, 2));
    const { data } = response;
    const users: any[] = (data ?? []).map((u: any) => ({
      userId: String(u.user_id ?? u.userId ?? u.uid),
      name: u.name,
      role: u.role
    }));

    if (users.length === 0) {
      console.warn('[ZKService] ⚠️ Device returned 0 users via TCP. The device user list may be empty or firmware returned no data.');
    }

    // Removed auto-upsert to enforce strict Hardware-to-Software mapping
    console.log(`[ZKService] 👥 ${users.length} raw user(s) fetched from device.`);
    return users;
  } catch (err: any) {
    throw new Error(classifyError(err));
  } finally {
    try {
      if (zk && (zk.socket || (zk.zudp && zk.zudp.socket) || (zk.ztcp && zk.ztcp.socket))) {
        if (typeof zk.disconnect === 'function') {
          await zk.disconnect();
        } else if (typeof zk.free === 'function') {
          await zk.free();
        }
      }
    } catch (err: any) {
      console.error('[ZKService] ❌ Cleanup failed:', err.message);
    }
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
    try {
      if (zk && (zk.socket || (zk.zudp && zk.zudp.socket) || (zk.ztcp && zk.ztcp.socket))) {
        if (typeof zk.disconnect === 'function') {
          await zk.disconnect();
        } else if (typeof zk.free === 'function') {
          await zk.free();
        }
      }
    } catch (err: any) {
      console.error('[ZKService] ❌ Cleanup failed:', err.message);
    }
  }
};

/** Legacy alias */
export const fetchDeviceLogs = async (): Promise<number> => {
  const { synced } = await getDeviceAttendance();
  return synced;
};

// ─── TASK 1: ZKTeco Device Synchronization ─────────────────────────────────────

export class ZKDeviceOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZKDeviceOfflineError';
  }
}

export interface EmployeePayload {
  // WHY: The user requested id: number, but Prisma schema defines User.id as String (UUID).
  id: string;
  zk_enroll_number: number;
  name: string;
  password?: string;
  role?: 0 | 14;
}

export interface SyncResult {
  success: boolean;
  action: 'created' | 'updated';
  enrollNumber: number;
}

/**
 * Reusable helper to manage ZKTeco connections safely.
 * @param fn Callback to execute with the connected ZK instance.
 */
export async function withZKConnection<T>(fn: (zk: any) => Promise<T>): Promise<T> {
  const zk = createZK();
  try {
    try {
      await connectProperly(zk);
    } catch (err: any) {
      throw new ZKDeviceOfflineError('Failed to connect to ZK device: ' + classifyError(err));
    }

    return await fn(zk);
  } finally {
    try {
      if (zk && (zk.socket || (zk.zudp && zk.zudp.socket) || (zk.ztcp && zk.ztcp.socket))) {
        if (typeof zk.disconnect === 'function') {
          await zk.disconnect();
        } else if (typeof zk.free === 'function') {
          await zk.free();
        }
      }
    } catch (err: any) {
      console.error('[ZKService] ❌ Cleanup failed in withZKConnection:', err.message);
    }
  }
}

/**
 * Syncs a user to the ZKTeco device, acting as an upsert.
 * @param employee The employee data to sync.
 */
async function syncUserToDevice(employee: EmployeePayload): Promise<SyncResult> {
  // Validate enrollNumber
  if (!Number.isInteger(employee.zk_enroll_number) || employee.zk_enroll_number < 1 || employee.zk_enroll_number > 32767) {
    throw new TypeError(`Invalid zk_enroll_number: ${employee.zk_enroll_number}. Must be an integer between 1 and 32767.`);
  }

  return await withZKConnection(async (zk) => {
    // 1. Fetch the user directly from the DB to get the freshest data.
    // WHY: Avoid stale data from the request payload and ensure the mapping is correct.
    const dbUser = await prisma.user.findUnique({
      where: { id: employee.id }
    });

    if (!dbUser) {
      throw new Error(`User with ID ${employee.id} not found in DB.`);
    }

    const enrollNumber = (dbUser as any).zk_enroll_number;
    if (!enrollNumber || enrollNumber === 0) {
      throw new Error(`Employee ${employee.id} has no ZKTeco enroll number assigned. Assign one before syncing.`);
    }

    // 2. Fetch existing users from the device
    const existingUsers = await getDeviceUsersRaw(zk);
    const existingEnrollNumbers = existingUsers.map((u: any) => parseInt(u.userId || u.uid || u.user_id, 10));

    // Determine if it's a create or update
    const action = existingEnrollNumbers.includes(enrollNumber) ? 'updated' : 'created';

    // 3. Prepare data
    // Truncate name safely to 24 chars
    const safeName = (employee.name || dbUser.name).substring(0, 24);
    const password = employee.password || '0';
    const role = employee.role ?? (dbUser.designationId ? 0 : 0); // Default to user if not specified

    // 4. Set User (Upsert)
    try {
      await zk.setUser(enrollNumber, enrollNumber.toString(), safeName, password, role);
      console.log(`[ZKService] User ${safeName} (Enroll: ${enrollNumber}) ${action} on device.`);
    } catch (err: any) {
      console.error(`[ZKService] Failed to set user ${enrollNumber}:`, err);
      throw new Error(`Failed to set user on device: ${err.message || err.toString()}`);
    }

    return { success: true, action, enrollNumber };
  });
}

/**
 * Deletes a user from the ZKTeco device by enrollNumber.
 * @param enrollNumber The ZKTeco enrollNumber to delete.
 */
async function deleteUserFromDevice(enrollNumber: number): Promise<void> {
  if (!Number.isInteger(enrollNumber) || enrollNumber < 1 || enrollNumber > 32767) {
    throw new TypeError(`Invalid zk_enroll_number: ${enrollNumber}. Must be an integer between 1 and 32767.`);
  }

  await withZKConnection(async (zk) => {
    try {
      // Library method might differ, usually deleteUser takes the ID as string or number
      await zk.deleteUser(enrollNumber);
      console.log(`[ZKService] User ${enrollNumber} deleted from device.`);
    } catch (err: any) {
      console.error(`[ZKService] Failed to delete user ${enrollNumber}:`, err);
      throw new Error(`Failed to delete user on device: ${err.message || err.toString()}`);
    }
  });
}

export const fetchUnregisteredDeviceUsers = async (): Promise<{ deviceUserId: number; name: string }[]> => {
  return await withZKConnection(async (zk) => {
    const rawUsers = await getDeviceUsersRaw(zk);
    
    // Fetch registered enroll numbers
    const dbUsers = await prisma.user.findMany({
      select: { zk_enroll_number: true }
    });
    const registeredIds = new Set(dbUsers.map(u => u.zk_enroll_number).filter(Boolean));

    const unregistered = rawUsers.filter((u: any) => {
      const uid = parseInt(u.userId || u.uid || u.user_id, 10);
      return !registeredIds.has(uid);
    });

    return unregistered.map((u: any) => ({
      deviceUserId: parseInt(u.userId || u.uid || u.user_id, 10),
      name: u.name || `User ${parseInt(u.userId || u.uid || u.user_id, 10)}`
    }));
  });
};

export const zkService = {
  syncUserToDevice,
  deleteUserFromDevice,
  fetchUnregisteredDeviceUsers
};
