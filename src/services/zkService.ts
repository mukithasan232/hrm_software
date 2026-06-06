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
// JavaScript's `new Date(localTimeString)` incorrectly interprets them as UTC,
// which would make every punch appear 6 hours later than it actually was.
// This helper corrects that by subtracting the 6-hour offset so that the
// resulting Date object represents the true UTC equivalent of the local punch time.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6 in milliseconds

export function parseDhakaTimestamp(rawTimestamp: any): Date {
  let rawTime = String(rawTimestamp).trim();
  
  // If zkteco-js returned a Date object, grab its local string format before Node mangles it
  if (rawTimestamp instanceof Date) {
    const yyyy = rawTimestamp.getFullYear();
    const MM = String(rawTimestamp.getMonth() + 1).padStart(2, '0');
    const dd = String(rawTimestamp.getDate()).padStart(2, '0');
    const hh = String(rawTimestamp.getHours()).padStart(2, '0');
    const mm = String(rawTimestamp.getMinutes()).padStart(2, '0');
    const ss = String(rawTimestamp.getSeconds()).padStart(2, '0');
    rawTime = `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
  }

  // Convert to valid ISO and append offset
  let isoString = rawTime.includes('T') ? rawTime : rawTime.replace(' ', 'T');
  if (!isoString.includes('+') && !isoString.includes('Z')) {
      isoString += '+06:00'; 
  }
  
  return new Date(isoString);
}

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
function createZK(forceTCP = false): InstanceType<typeof ZKLib> {
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
  // UDP is the default for attendance logs (faster); TCP is more reliable for user data
  zk.connectionType = forceTCP ? 'tcp' : 'udp';
  return zk;
}

// ─── Punch type resolver ───────────────────────────────────────────────────────
export function getPunchType(log: any): string {
  // Enforce strict mapping based on device state or punch integer.
  // The device typically returns 1 for Check-Out.
  const state = log.state !== undefined ? log.state : (log.punch !== undefined ? log.punch : log.type);
  const numericState = typeof state === 'number' ? state : parseInt(state, 10);
  
  return numericState === 1 ? 'CheckOut' : 'CheckIn';
}

/**
 * Resolves the punch type securely directly from the device's log state.
 * Deprecated DB fallback inference logic removed in favor of strict mapping.
 */
export async function resolvePunchType(
  employeeId: string,
  timestamp: Date,
  log: any,
  processedEmpDays?: Set<string>
): Promise<string> {
  return getPunchType(log);
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

// ─── Connection Helper ─────────────────────────────────────────────────────────────────
async function connectProperly(zk: any): Promise<void> {
  if (zk.connectionType === 'udp') {
    // Explicitly bypass zk.createSocket() which hardcodes a TCP attempt first
    if (zk.zudp && typeof zk.zudp.createSocket === 'function') {
      await zk.zudp.createSocket();
    } else {
      await zk.createSocket();
    }
  } else {
    // TCP: use the ztcp sub-socket (not zudp)
    if (zk.ztcp?.createSocket) {
      await zk.ztcp.createSocket();
    } else {
      await zk.createSocket();
    }
  }

  // Give the socket a moment to breathe
  await new Promise(r => setTimeout(r, 1000));

  try {
    // Implement a strict 5-second race timeout because zkteco-js .connect() sometimes hangs infinitely
    await Promise.race([
      zk.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout - device unreachable')), 5000))
    ]);
    console.log(`[ZKService] 🔌 Connected using ${zk.connectionType.toUpperCase()}`);

    // Log real-time logs to catch punches as they happen
    zk.getRealTimeLogs((data: any) => {
      console.log('[ZKService] 🕒 Real-time Log Received:', data);
    });
  } catch (error: any) {
    console.error('[ZKTeco Connection Error]:', error.message);
    throw error;
  }
}

// ─── Helper to fetch raw users directly ───────────────────────────────────────
// K60 devices often return empty user lists over UDP — retry with TCP if needed.
async function getDeviceUsersRaw(zk: any): Promise<any[]> {
  try {
    const response = await zk.getUsers();
    console.log(`[ZKService] 🔍 Raw Users Response (${zk.connectionType.toUpperCase()}):`, JSON.stringify(response, null, 2));
    const { data } = response;
    const users = Array.isArray(data) ? data : [];

    // K60 firmware quirk: UDP sometimes returns empty user list even when users exist.
    // Fall back to a separate TCP connection to fetch users.
    if (users.length === 0 && zk.connectionType === 'udp') {
      console.warn('[ZKService] ⚠️ UDP returned 0 users. Retrying with TCP fallback...');
      const zkTcp = createZK(true); // force TCP
      try {
        await connectProperly(zkTcp);
        const tcpResponse = await zkTcp.getUsers();
        console.log('[ZKService] 🔍 Raw Users Response (TCP):', JSON.stringify(tcpResponse, null, 2));
        const tcpData = Array.isArray(tcpResponse?.data) ? tcpResponse.data : [];
        console.log(`[ZKService] 👥 TCP returned ${tcpData.length} user(s).`);
        return tcpData;
      } catch (tcpErr) {
        console.warn('[ZKService] ⚠️ TCP user fetch also failed:', tcpErr);
        return [];
      } finally {
        try { await zkTcp.disconnect(); } catch (_) {}
      }
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

/**
 * Fetch attendance logs from device → upsert into MongoDB.
 */
export const getDeviceAttendance = async (): Promise<{ synced: number; skipped: number; total: number }> => {
  const zk = createZK();
  const currentZkIp = process.env.ZK_DEVICE_IP || 'Unknown IP';
  try {
    await connectProperly(zk);
    console.log(`[ZKService] ✅ Connected to ${currentZkIp} (${zk.connectionType})`);

    // 1. Fetch Users first and Upsert them into MariaDB
    console.log('[ZKService] 👥 Syncing users from device to database...');
    const rawUsers = await getDeviceUsersRaw(zk);
    const hashedPassword = await bcrypt.hash('password123', 10);
    const userIdMap = new Map<string, string>(); // maps device employeeId -> User.id (UUID)
    
    // Fetch default designations
    const adminDesig = await prisma.designation.findFirst({ where: { name: 'Admin' } });
    const empDesig = await prisma.designation.findFirst({ where: { name: 'Employee' } });

    for (const u of rawUsers) {
      const employeeId = String(u.user_id ?? u.userId ?? u.uid);
      const name = u.name || `User ${employeeId}`;
      const normalizedEmail = `user${employeeId}@hrm.test`;
      const dbUser = await prisma.user.upsert({
        where: { employeeId },
        update: { name },
        create: {
          employeeId,
          name,
          email: normalizedEmail,
          password: hashedPassword,
          designationId: (u.role === 14 ? adminDesig?.id : empDesig?.id) || undefined,
          baseSalary: 0,
          isActive: true
        }
      });
      userIdMap.set(employeeId, dbUser.id);
    }

    // Load any other existing users in database into the userIdMap
    const dbUsers = await prisma.user.findMany({});
    for (const user of dbUsers) {
      userIdMap.set(user.employeeId, user.id);
    }

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
      // Emit socket event to frontend via global.io
      const io = (global as any).io;
      if (io) {
        io.emit('attendanceUpdate', { checkIn: true });
      }
      return { synced: 0, skipped: 0, total: 0 };
    }
    console.log(`[ZKService] 📋 ${rawLogs.length} raw record(s) from device.`);

    // Sort logs chronologically ascending (earliest to latest) to guarantee correct CheckIn/CheckOut determination
    const sortedRawLogs = Array.isArray(rawLogs) ? [...rawLogs].sort((a: any, b: any) => new Date(a.recordTime || a.record_time).getTime() - new Date(b.recordTime || b.record_time).getTime()) : [];

    let synced = 0;
    let skipped = 0;
    const processedEmpDays = new Set<string>();

    // Process in chunks of 100 for better performance
    const chunkSize = 100;
    for (let i = 0; i < sortedRawLogs.length; i += chunkSize) {
      const chunk = sortedRawLogs.slice(i, i + chunkSize);

      for (const log of chunk) {
        try {
          const deviceEmpId = String(log.deviceUserId ?? log.user_id ?? log.userId ?? log.uid);
          // parseDhakaTimestamp converts the device's local UTC+6 time string
          // into a proper UTC Date for storage in the database.
          const timestamp = parseDhakaTimestamp(log.recordTime || log.record_time);

          if (isNaN(timestamp.getTime())) {
            skipped++;
            continue;
          }

          // Map deviceEmpId (e.g. "5") to the actual DB User's UUID
          let employeeId = userIdMap.get(deviceEmpId);
          if (!employeeId) {
            // Auto-create user if they are not in the DB to prevent foreign key errors
            const name = `User ${deviceEmpId}`;
            const normalizedEmail = `user${deviceEmpId}-${Date.now()}@hrm.test`;
            const dbUser = await prisma.user.create({
              data: {
                employeeId: deviceEmpId,
                name,
                email: normalizedEmail,
                password: hashedPassword,
                baseSalary: 0,
                isActive: true,
                documents: {}
              }
            });
            userIdMap.set(deviceEmpId, dbUser.id);
            employeeId = dbUser.id;
          }

          const punchType = await resolvePunchType(employeeId, timestamp, log, processedEmpDays);

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
              deviceId: currentZkIp,
            },
          });
          synced++;
        } catch (err: any) {
          console.error(`[ZKService] ❌ Failed to save log inside loop:`, err.message);
          skipped++;
        }
      }

      console.log(`[ZKService] Chunks progress: ${Math.min(i + chunkSize, sortedRawLogs.length)}/${sortedRawLogs.length}`);
    }

    console.log(`[ZKService] ✔  Synced: ${synced} | Total: ${sortedRawLogs.length}`);

    // Automatically self-heal today's attendance logs to guarantee earliest = CheckIn, latest = CheckOut
    await healTodaysData();

    // Emit socket event to frontend via global.io
    const io = (global as any).io;
    if (io) {
      io.emit('attendanceUpdate', { checkIn: true });
      console.log('[ZKService] 📡 Emitted attendanceUpdate to frontend.');
    }

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
 * Fetch all users stored on the device and sync them to database.
 * Uses TCP directly as it is more reliable for user data on K60 devices.
 */
export const getDeviceUsers = async (): Promise<any[]> => {
  // Try TCP first for user fetching — more reliable on K60 firmware
  const zk = createZK(true);
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

    // Upsert into DB
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const adminDesig = await prisma.designation.findFirst({ where: { name: 'Admin' } });
    const empDesig = await prisma.designation.findFirst({ where: { name: 'Employee' } });

    for (const dUser of users) {
      const employeeId = dUser.userId;
      const name = dUser.name || `User ${employeeId}`;
      const normalizedEmail = `user${employeeId}@hrm.test`;

      await prisma.user.upsert({
        where: { employeeId },
        update: { name },
        create: {
          employeeId,
          name,
          email: normalizedEmail,
          password: hashedPassword,
          designationId: (dUser.role === 14 ? adminDesig?.id : empDesig?.id) || undefined,
          baseSalary: 0,
          isActive: true
        }
      });
    }

    console.log(`[ZKService] 👥 ${users.length} user(s) synced and saved to MariaDB.`);
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
