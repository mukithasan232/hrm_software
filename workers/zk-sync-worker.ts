import { PrismaClient } from '@prisma/client';
// @ts-ignore
import ZKLib from 'zkteco-js';
import cron from 'node-cron';
import dgram from 'dgram';

// Initialize standalone Prisma Client
const prisma = new PrismaClient();

// ─── Constants ──────────────────────────────────────────────────────────────
const ZK_TIMEOUT = 40000;
const ZK_INPORT = 0;
const CONNECT_TIMEOUT_MS = 20000;
const DEBOUNCE_MS = 10 * 60 * 1000;
const CROSS_MIDNIGHT_WINDOW_MS = 18 * 60 * 60 * 1000;
const STALE_SESSION_MS = 14 * 60 * 60 * 1000;

// ─── State Variables ───────────────────────────────────────────────────────
let zkInstance: any = null;
let isListenerActive = false;
let isConnecting = false;
let activeReconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;
let circuitBreakerUntil = 0;
let deviceMutex = Promise.resolve();

// ─── Connection Helpers ────────────────────────────────────────────────────
const checkUdpPort = async (ip: string, port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from([0x00]);
    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        client.close();
        resolve(false);
      }
    }, 2000);

    client.send(message, port, ip, (err) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        client.close();
        resolve(!err);
      }
    });
  });
};

async function safeDisconnect(zk: any) {
  try {
    if (zk && (zk.socket || (zk.zudp && zk.zudp.socket) || (zk.ztcp && zk.ztcp.socket))) {
      if (typeof zk.disconnect === 'function') await zk.disconnect();
      else if (typeof zk.free === 'function') await zk.free();
    }
  } catch (err: any) {
    console.warn('[Worker] Non-fatal disconnect issue:', err.message);
  }
}

async function createZK(): Promise<InstanceType<typeof ZKLib>> {
  const device = await prisma.device.findFirst({ where: { isActive: true } });
  if (!device) throw new Error('No active ZKTeco device configured.');

  const zk = new ZKLib(device.ipAddress, device.port || 4370, ZK_TIMEOUT, ZK_INPORT);
  zk.password = device.commKey || 0;
  zk.connectionType = 'tcp';
  (zk as any).deviceIp = device.ipAddress;
  return zk;
}

// ─── Core Logic ────────────────────────────────────────────────────────────
export const parseDeviceTime = (deviceDateInput: any): Date => {
  if (!deviceDateInput) return new Date(NaN);
  const deviceDate = new Date(deviceDateInput);
  if (isNaN(deviceDate.getTime())) return new Date(NaN);
  const y = deviceDate.getFullYear();
  const m = String(deviceDate.getMonth() + 1).padStart(2, '0');
  const d = String(deviceDate.getDate()).padStart(2, '0');
  const h = String(deviceDate.getHours()).padStart(2, '0');
  const min = String(deviceDate.getMinutes()).padStart(2, '0');
  const s = String(deviceDate.getSeconds()).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}+06:00`);
};

export async function resolvePunchType(
  employeeId: string,
  timestamp: Date,
  log: any
): Promise<string | null> {
  const tzOffset = 6 * 60 * 60 * 1000;
  const localDate = new Date(timestamp.getTime() + tzOffset);
  
  const startOfDayLocal = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 0, 0, 0, 0));
  const startOfTodayUTC = new Date(startOfDayLocal.getTime() - tzOffset);
  const endOfTodayUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000 - 1);

  const lastLog = await prisma.attendanceLog.findFirst({
    where: { employeeId, timestamp: { gte: startOfTodayUTC, lte: endOfTodayUTC } },
    orderBy: { timestamp: 'desc' },
  });

  if (lastLog && timestamp.getTime() === lastLog.timestamp.getTime()) return null;

  return lastLog?.punchType === 'CheckIn' ? 'CheckOut' : 'CheckIn';
}

async function processBiometricPunch(employeeId: string, punchTime: Date, deviceIp: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.findUnique({
        where: { id: employeeId },
        select: {
          shiftEndTime: true,
          shift: { select: { endTime: true } },
          customDepartment: { select: { shiftEndTime: true } },
        },
      });

      const shiftEndTimeStr = userRecord?.shift?.endTime || userRecord?.shiftEndTime || userRecord?.customDepartment?.shiftEndTime || '17:00';

      const lastPunch = await tx.attendanceLog.findFirst({
        where: { employeeId },
        orderBy: { timestamp: 'desc' },
      });

      if (lastPunch) {
        const lastActionTime = lastPunch.checkOut ? lastPunch.checkOut.getTime() : lastPunch.timestamp.getTime();
        if (punchTime.getTime() - lastActionTime < DEBOUNCE_MS) return { result: 'debounced' };
      }

      const windowStart = new Date(punchTime.getTime() - CROSS_MIDNIGHT_WINDOW_MS);
      const openSession = await tx.attendanceLog.findFirst({
        where: { employeeId, checkOut: null, isMissingOut: false, timestamp: { gte: windowStart, lte: punchTime } },
        orderBy: { timestamp: 'desc' },
      });

      if (openSession) {
        if (punchTime.getTime() - openSession.timestamp.getTime() > STALE_SESSION_MS) {
          await tx.attendanceLog.update({
            where: { id: openSession.id },
            data: { checkOut: new Date(openSession.timestamp.getTime() + STALE_SESSION_MS), isMissingOut: true },
          });
        } else {
          const BD_TZ_OFFSET_MS = 6 * 60 * 60 * 1000;
          const checkInLocal = new Date(openSession.timestamp.getTime() + BD_TZ_OFFSET_MS);
          const shiftEndUTC = new Date(`${checkInLocal.getUTCFullYear()}-${String(checkInLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(checkInLocal.getUTCDate()).padStart(2, '0')}T${shiftEndTimeStr}:00+06:00`);
          
          const effectiveShiftEndUTC = shiftEndUTC <= openSession.timestamp ? new Date(shiftEndUTC.getTime() + 24 * 60 * 60 * 1000) : shiftEndUTC;
          const earlyLeaveMinutes = Math.floor(Math.max(0, effectiveShiftEndUTC.getTime() - punchTime.getTime()) / 60000);

          await tx.attendanceLog.update({
            where: { id: openSession.id },
            data: { checkOut: punchTime, earlyLeaveMinutes },
          });
          return { result: 'checked_out' };
        }
      }

      const existingExact = await tx.attendanceLog.findUnique({
        where: { employeeId_timestamp: { employeeId, timestamp: punchTime } },
      });

      if (existingExact) return { result: 'debounced' };

      await tx.attendanceLog.create({
        data: { employeeId, timestamp: punchTime, punchType: 'CheckIn', deviceId: deviceIp, workMode: 'IN_HOUSE' },
      });
      return { result: 'checked_in' };
    });
  } catch (err: any) {
    console.error(`[Worker] Transaction failed for ${employeeId}:`, err.message);
    throw err;
  }
}

const syncZkTecoData = async () => {
  const zk = await createZK();
  const currentZkIp = (zk as any).deviceIp || 'Unknown IP';
  try {
    zk.connectionType = 'tcp';
    if (zk.ztcp && typeof zk.ztcp.createSocket === 'function') await zk.ztcp.createSocket();
    else await zk.createSocket();
    
    await new Promise(r => setTimeout(r, 1000));
    await Promise.race([zk.connect(), new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 20000))]);

    const usersRes = await zk.getUsers();
    const userIdMap = new Map<string, string>();
    const dbUsers = await prisma.user.findMany();
    for (const user of dbUsers) {
      if (user.employeeId) userIdMap.set(user.employeeId, user.id);
      if (user.zktecoId) userIdMap.set(String(user.zktecoId), user.id);
    }

    const attendanceRes = await zk.getAttendances();
    const rawLogs = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const recentLogs = rawLogs.filter((log: any) => {
      const deviceTime = log.timestamp || log.recordTime || log.record_time;
      if (!deviceTime) return false;
      return parseDeviceTime(deviceTime) >= threeDaysAgo;
    });

    const sortedRawLogs = [...recentLogs].sort((a: any, b: any) => new Date(a.timestamp || a.recordTime || a.record_time).getTime() - new Date(b.timestamp || b.recordTime || b.record_time).getTime());

    const dbRawLogs = await prisma.rawDeviceLog.findMany({
      where: { recordTime: { gte: threeDaysAgo } },
      select: { deviceUserId: true, recordTime: true }
    });
    const dbRawSet = new Set(dbRawLogs.map((l: any) => `${l.deviceUserId}_${l.recordTime.getTime()}`));

    const newLogsToProcess: any[] = [];
    const newRawInserts: any[] = [];

    for (const log of sortedRawLogs) {
      const deviceEmpId = String(log.deviceUserId ?? log.userId ?? log.uid);
      const deviceTime = log.timestamp || log.recordTime || log.record_time;
      if (!deviceTime) continue;
      
      const rawTimestamp = parseDeviceTime(deviceTime);
      rawTimestamp.setMilliseconds(0);

      const collisionKey = `${deviceEmpId}_${rawTimestamp.getTime()}`;
      if (dbRawSet.has(collisionKey)) continue;

      newRawInserts.push({
        deviceUserId: deviceEmpId,
        recordTime: rawTimestamp,
        punchType: log.punchType != null ? String(log.punchType) : null,
        ip: currentZkIp,
      });

      const employeeId = userIdMap.get(deviceEmpId);
      if (employeeId) newLogsToProcess.push({ employeeId, recordTime: rawTimestamp });
      
      dbRawSet.add(collisionKey);
    }

    if (newRawInserts.length > 0) {
      await prisma.rawDeviceLog.createMany({ data: newRawInserts, skipDuplicates: true });
    }

    for (const log of newLogsToProcess) {
      try {
        await processBiometricPunch(log.employeeId, log.recordTime, currentZkIp);
      } catch (err) { }
    }
    console.log(`[Worker] Cron Sync Complete. Processed ${newLogsToProcess.length} new punches.`);
  } catch (err: any) {
    console.error('[Worker] Cron Sync Error:', err.message);
  } finally {
    await safeDisconnect(zk);
  }
};

const connectAndListen = async () => {
  if (!isListenerActive || isConnecting) return;
  if (Date.now() < circuitBreakerUntil) {
    if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
    activeReconnectTimeout = setTimeout(connectAndListen, circuitBreakerUntil - Date.now());
    return;
  }

  const device = await prisma.device.findFirst({ where: { isActive: true } });
  if (!device) return;

  isConnecting = true;
  deviceMutex = deviceMutex.then(async () => {
    if (!isListenerActive) { isConnecting = false; return; }
    try {
      if (zkInstance) {
        try { if (zkInstance.socket) zkInstance.socket.removeAllListeners(); await safeDisconnect(zkInstance); } catch (_) {}
        zkInstance = null;
      }
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      const zk = new ZKLib(device.ipAddress, device.port || 4370, ZK_TIMEOUT, ZK_INPORT);
      zk.password = device.commKey || 0;
      zk.connectionType = 'udp';

      if (zk.zudp && typeof zk.zudp.createSocket === 'function') await zk.zudp.createSocket();
      else await zk.createSocket();
      await new Promise(r => setTimeout(r, 500));
      await Promise.race([zk.connect(), new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), CONNECT_TIMEOUT_MS))]);

      zkInstance = zk;
      consecutiveFailures = 0;
      console.log(`[Worker] ✅ Realtime listener connected to ${device.ipAddress}`);

      zkInstance.getRealTimeLogs(async (data: any) => {
        try {
          const deviceEmpId = String(data.userId);
          const deviceTime = data.attTime || data.recordTime || data.record_time;
          if (!deviceTime) return;

          const parsedTimestamp = parseDeviceTime(new Date(deviceTime));
          parsedTimestamp.setMilliseconds(0);

          const user = await prisma.user.findFirst({
            where: { OR: [{ employeeId: deviceEmpId }, { zktecoId: parseInt(deviceEmpId, 10) || -1 }] }
          });

          if (!user) {
            let punchType = (data.punchType || 'UNKNOWN').toString().toUpperCase();
            if (['0', 'CHECKIN'].includes(punchType)) punchType = 'CheckIn';
            else if (['1', 'CHECKOUT'].includes(punchType)) punchType = 'CheckOut';
            
            await prisma.rawDeviceLog.upsert({
              where: { deviceUserId_recordTime: { deviceUserId: deviceEmpId, recordTime: parsedTimestamp } },
              update: { punchType: punchType === 'UNKNOWN' ? null : punchType },
              create: { deviceUserId: deviceEmpId, recordTime: parsedTimestamp, punchType: punchType === 'UNKNOWN' ? null : punchType, ip: device.ipAddress! }
            });
            return;
          }

          const resolvedPunchType = await resolvePunchType(user.id, parsedTimestamp, data);
          if (!resolvedPunchType) return;

          await prisma.attendanceLog.upsert({
            where: { employeeId_timestamp: { employeeId: user.id, timestamp: parsedTimestamp } },
            update: { punchType: resolvedPunchType as any },
            create: { employeeId: user.id, timestamp: parsedTimestamp, punchType: resolvedPunchType as any, deviceId: device.ipAddress! },
          });
          console.log(`[Worker] Processed live punch for ${user.name} at ${parsedTimestamp.toISOString()}`);
        } catch (err: any) {
          console.error(`[Worker] Live punch error:`, err.message);
        }
      });

      heartbeatInterval = setInterval(async () => {
        try { if (zkInstance) await zkInstance.getTime(); } catch {
          clearInterval(heartbeatInterval!); zkInstance = null; isConnecting = false;
          if (isListenerActive) {
            if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
            activeReconnectTimeout = setTimeout(connectAndListen, 5000);
          }
        }
      }, 60000);

    } catch (err: any) {
      console.error(`[Worker] Connection failed:`, err.message);
      consecutiveFailures++;
      zkInstance = null;
      if (consecutiveFailures >= 3) circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
      if (isListenerActive) {
        if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
        activeReconnectTimeout = setTimeout(connectAndListen, consecutiveFailures >= 3 ? 10 * 60 * 1000 : 15000);
      }
    } finally {
      isConnecting = false;
    }
  });
};

// ─── Lifecycle ─────────────────────────────────────────────────────────────
console.log('[Worker] Starting standalone ZKTeco background worker...');

// 1. Schedule Polling (every 5 minutes to mimic realtimeService background sync)
cron.schedule('*/5 * * * *', async () => {
  console.log('[Worker] 🕒 Running 5-minute background bulk sync...');
  deviceMutex = deviceMutex.then(async () => {
    isListenerActive = false;
    if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (zkInstance) {
      try { if (zkInstance.socket) zkInstance.socket.removeAllListeners(); await safeDisconnect(zkInstance); } catch (_) {}
      zkInstance = null;
    }
    await new Promise(r => setTimeout(r, 1000));
    try { await syncZkTecoData(); } catch (err) { }
    isListenerActive = true;
    isConnecting = false;
    activeReconnectTimeout = setTimeout(connectAndListen, 3000);
  });
});

// 2. Start Realtime Listener
isListenerActive = true;
connectAndListen();

// 3. Graceful Shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[Worker] Received ${signal}. Shutting down worker...`);
  isListenerActive = false;
  if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (zkInstance) {
    console.log('[Worker] Disconnecting ZKTeco socket...');
    await safeDisconnect(zkInstance);
  }
  console.log('[Worker] Disconnecting Prisma Client...');
  await prisma.$disconnect();
  console.log('[Worker] Clean shutdown complete.');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

