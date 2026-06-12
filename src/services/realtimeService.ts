import { Server } from 'socket.io';
// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';
import { resolvePunchType, parseDeviceTime } from './zkService';
import dgram from 'dgram';

// ─── Connection Constants ────────────────────────────────────────────────────
const ZK_TIMEOUT = 10000; // Reduced to 10s — enough for LAN, fast enough to fail quickly
const ZK_INPORT = 0;

// ─── Connection Timeout ──────────────────────────────────────────────────────
// How long a single connect() call is allowed to run before we abort.
const CONNECT_TIMEOUT_MS = 5000;

// ─── PRIVATE: Pre-flight Network Check ───────────────────────────────────────
/**
 * Verifies if the UDP port is reachable before attempting the ZK handshake.
 */
const checkUdpPort = async (ip: string, port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from([0x00]); // Dummy byte

    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        client.close();
        resolve(false);
      }
    }, 2000);

    client.send(message, port, ip, (err) => {
      if (err) {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          client.close();
          resolve(false);
        }
      } else {
        // UDP is connectionless, so "success" here just means the packet was sent.
        // But if the network is totally unreachable, send() often fails immediately.
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          client.close();
          resolve(true);
        }
      }
    });
  });
};

// ─── Module-level state ──────────────────────────────────────────────────────

let io: Server;
let zkInstance: any = null;
let isConnecting = false;
let isListenerActive = false;
let activeReconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Promise-based mutex — serializes all device operations.
let deviceMutex = Promise.resolve();

// ─── PUBLIC: Init ─────────────────────────────────────────────────────────────
/**
 * Called once from server.js on boot.
 * Registers socket.io — does NOT touch the ZKTeco device.
 * All device connections happen on-demand when the user clicks Sync.
 */
export const initRealtimeAttendance = (socketIo: Server): void => {
  io = socketIo;
  (global as any).io = socketIo;
  console.log('[RealtimeService] ✅ Initialized (socket.io ready). Starting ZKTeco realtime listener...');
  startRealtimeListener();
};

// ─── PUBLIC: Mutex-wrapped operation runner ──────────────────────────────────
/**
 * Runs a device operation exclusively, pausing the realtime listener while
 * the operation runs and resuming it afterwards.
 * Called by attendanceController for manual syncs.
 */
export const runWithDeviceLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    deviceMutex = deviceMutex.then(async () => {
      console.log('[RealtimeService] 🔒 Mutex acquired for operation.');

      // Pause realtime listener and clear any pending reconnects
      isListenerActive = false;
      if (activeReconnectTimeout) {
        clearTimeout(activeReconnectTimeout);
        activeReconnectTimeout = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Disconnect existing realtime socket to free the device port
      if (zkInstance) {
        console.log('[RealtimeService] ⏸️ Pausing realtime listener to free device port...');
        try {
          if (zkInstance.socket && typeof zkInstance.socket.removeAllListeners === 'function') {
            zkInstance.socket.removeAllListeners();
          }
          if (zkInstance.socket && typeof zkInstance.socket.removeListener === 'function') {
            // Some versions or internal calls might expect this
          }
          if (typeof zkInstance.disconnect === 'function') {
            await zkInstance.disconnect();
          } else if (typeof zkInstance.free === 'function') {
            await zkInstance.free();
          }
        } catch (_) { }
        zkInstance = null;
      }

      // Brief pause for OS to release the UDP port
      await new Promise(r => setTimeout(r, 1000));

      try {
        const result = await operation();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        // Resume realtime listener after sync completes
        isListenerActive = true;
        isConnecting = false;
        console.log('[RealtimeService] 🔓 Mutex released. Resuming realtime listener in 3s...');
        if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
        activeReconnectTimeout = setTimeout(connectAndListen, 3000);
      }
    });
  });
};

// ─── PUBLIC: Manually trigger realtime listener ──────────────────────────────
/**
 * Called after a successful manual sync to begin listening for real-time punches.
 * Safe to call multiple times — guards against duplicate connections.
 */
export const startRealtimeListener = (): void => {
  if (!isListenerActive) {
    isListenerActive = true;
    connectAndListen();
  }
};

// ─── PRIVATE: Connect and attach realtime punch listener ─────────────────────
const connectAndListen = async (): Promise<void> => {
  if (!isListenerActive) return;
  if (isConnecting) return;

  // @ts-ignore - The device model is dynamically generated by Prisma
  const device = await (prisma as any).device.findFirst({ where: { isActive: true } });
  
  // If no device is configured, silently skip — no crashes.
  if (!device || !device.ipAddress) {
    console.warn('[RealtimeService] ⚠️ Active device not set in database. Realtime listener skipped.');
    return;
  }

  const ZK_IP = device.ipAddress;
  const ZK_PORT = device.port || 4370;
  const ZK_PASSWORD = device.commKey || 0;

  isConnecting = true;

  deviceMutex = deviceMutex.then(async () => {
    if (!isListenerActive) { isConnecting = false; return; }

    try {
      // 1. Pre-flight Check
      console.log(`[RealtimeService] 🔍 Pre-flight check: Probing ${ZK_IP}:${ZK_PORT} via UDP...`);
      const isReachable = await checkUdpPort(ZK_IP, ZK_PORT);
      if (!isReachable) {
        throw new Error(`Network Unreachable: Cannot send UDP packets to ${ZK_IP}:${ZK_PORT}. Check your network/firewall.`);
      }

      // 2. Clean up any stale connection
      if (zkInstance) {
        try {
          if (zkInstance.socket && typeof zkInstance.socket.removeAllListeners === 'function') {
            zkInstance.socket.removeAllListeners();
          }
          if (typeof zkInstance.disconnect === 'function') {
            await zkInstance.disconnect();
          } else if (typeof zkInstance.free === 'function') {
            await zkInstance.free();
          }
        } catch (_) { }
        zkInstance = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      console.log(`[RealtimeService] 🔌 Connecting to ${ZK_IP}:${ZK_PORT} (UDP) for realtime punches...`);
      const zk = new ZKLib(ZK_IP, ZK_PORT, ZK_TIMEOUT, ZK_INPORT);
      zk.password = ZK_PASSWORD;
      zk.connectionType = 'udp';

      // Explicitly force UDP socket creation to bypass zkteco-js's hardcoded TCP handshake attempt
      try {
        if (zk.zudp && typeof zk.zudp.createSocket === 'function') {
          await zk.zudp.createSocket();
        } else {
          await zk.createSocket();
        }
      } catch (socketErr: any) {
        const msg = socketErr?.message || (typeof socketErr === 'string' ? socketErr : 'Unknown Socket Error');
        throw new Error(`Socket creation failed: ${msg}`);
      }

      await new Promise(r => setTimeout(r, 500));

      // Strict 5-second timeout on connect() — prevents indefinite hang
      console.log(`[RealtimeService] ⏳ Authenticating with device (CommKey: ${ZK_PASSWORD})...`);
      await Promise.race([
        zk.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Authentication Timeout: Device did not respond to handshake. Verify ZK_COMM_KEY and IP.')), CONNECT_TIMEOUT_MS)
        ),
      ]);

      zkInstance = zk;
      console.log(`[RealtimeService] ✅ Realtime listener connected to ${ZK_IP}`);


      // ── Real-time punch handler ──────────────────────────────────────────
      zkInstance.getRealTimeLogs(async (data: any) => {
        const startTime = Date.now();
        console.log(`\n======================================================`);
        console.log(`[RealtimeService] 🕒 DIRECT TCP PUNCH RECEIVED`);
        console.log(`[RealtimeService] Time: ${new Date().toISOString()}`);
        console.log(`[RealtimeService] Raw Device Data:`, JSON.stringify(data, null, 2));
        console.log(`======================================================\n`);
        try {
          const deviceEmpId = String(data.userId);
          if (!data.recordTime && !data.timestamp && !data.record_time && !data.attTime) {
            console.log("[RealtimeService] ⚠️ Skipping empty heartbeat packet...");
            return;
          }
          
          const deviceTime = data.attTime || data.recordTime || data.record_time;

          const parsedTimestamp = parseDeviceTime(new Date(deviceTime));

          if (isNaN(parsedTimestamp.getTime())) {
            console.error('[RealtimeService] ❌ Invalid timestamp:', deviceTime);
            return;
          }

          // Strip milliseconds so the @@unique([employeeId, timestamp]) constraint
          // matches correctly. A live punch arriving at 10:19:18.432 would otherwise
          // fail to match an existing row stored as 10:19:18.000, creating a duplicate.
          if (parsedTimestamp.getMilliseconds() !== 0) {
            console.warn(`[RealtimeService] ⚠️ Sub-second jitter stripped (${parsedTimestamp.getMilliseconds()}ms). Raw: ${deviceTime}`);
          }
          parsedTimestamp.setMilliseconds(0);

          // Strict opt-in: only process punches from mapped (known) employees
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { employeeId: deviceEmpId },
                { zk_enroll_number: parseInt(deviceEmpId, 10) || -1 }
              ]
            }
          });

          if (!user) {
            console.warn(`[RealtimeService] ⚠️ Unmapped device user "${deviceEmpId}" — storing safely in RawDeviceLog.`);
            let punchType = (data.punchType || 'UNKNOWN').toString().toUpperCase();
            if (['0', 'CHECKIN'].includes(punchType)) punchType = 'CheckIn';
            else if (['1', 'CHECKOUT'].includes(punchType)) punchType = 'CheckOut';
            
            await prisma.rawDeviceLog.upsert({
              where: { deviceUserId_recordTime: { deviceUserId: deviceEmpId, recordTime: parsedTimestamp } },
              update: { punchType: punchType === 'UNKNOWN' ? null : punchType },
              create: { deviceUserId: deviceEmpId, recordTime: parsedTimestamp, punchType: punchType === 'UNKNOWN' ? null : punchType, ip: ZK_IP }
            });
            return;
          }

          const employeeId = user.id;
          const employeeName = user.name;

          // resolvePunchType now only blocks exact-same-second duplicates (no 30-min guard)
          let punchType = (data.punchType || 'UNKNOWN').toString().toUpperCase();
          if (['0', 'CHECKIN'].includes(punchType)) punchType = 'CheckIn';
          else if (['1', 'CHECKOUT'].includes(punchType)) punchType = 'CheckOut';

          if (punchType === 'UNKNOWN') {
            console.log("[RealtimeService] ⚠️ Skipping UNKNOWN punch type...");
            return;
          }

          const resolvedPunchType = await resolvePunchType(employeeId, parsedTimestamp, data);

          if (!resolvedPunchType) {
            console.log(`[RealtimeService] ⏭️  Exact-second duplicate punch for ${employeeName} — skipped (DB upsert handles idempotency).`);
            return;
          }

          console.log(`[ZK Sync] Raw Time:`, deviceTime, '| DB UTC:', parsedTimestamp.toISOString(), '| PunchType:', resolvedPunchType);

          const newLog = await prisma.attendanceLog.upsert({
            where: { employeeId_timestamp: { employeeId, timestamp: parsedTimestamp } },
            update: { punchType: resolvedPunchType as any },
            create: { employeeId, timestamp: parsedTimestamp, punchType: resolvedPunchType as any, deviceId: ZK_IP! },
          });

          if (io) {
            setImmediate(() => {
              io.emit('new-attendance', { ...newLog, employeeName });
              io.emit('attendanceUpdate', { checkIn: punchType === 'CheckIn' });
              console.log(`[RealtimeService] 📡 Emitted: ${employeeName} [${punchType}] in ${Date.now() - startTime}ms.`);
            });
          }
        } catch (err: any) {
          console.error(`\n======================================================`);
          console.error(`[RealtimeService] 🚨 CRITICAL ERROR in realtime handler after ${Date.now() - startTime}ms.`);
          console.error(`[RealtimeService] Error Details:`, err.message);
          console.error(`======================================================\n`);
        }
      });

      // ── Heartbeat keepalive (60s) ────────────────────────────────────────
      heartbeatInterval = setInterval(async () => {
        try {
          if (zkInstance) await zkInstance.getTime();
        } catch {
          console.log('[RealtimeService] 💔 Heartbeat failed — scheduling reconnect in 5s...');
          clearInterval(heartbeatInterval!);
          heartbeatInterval = null;
          zkInstance = null;
          isConnecting = false;
          if (isListenerActive) {
            if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
            activeReconnectTimeout = setTimeout(connectAndListen, 5000);
          }
        }
      }, 60_000);

      isConnecting = false;
    } catch (err: any) {
      // ── Graceful failure — log and schedule a delayed retry, never crash ──
      const errorMessage = err?.message || (typeof err === 'string' ? err : 'Unknown error');
      console.error(`[RealtimeService] ❌ Connection failed: ${errorMessage}`);

      if (err?.stack) {
        console.debug(`[RealtimeService] Debug Stack:`, err.stack);
      }

      isConnecting = false;
      zkInstance = null;
      if (isListenerActive) {
        if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
        // Back off 15 seconds before retrying so we don't spam the device
        activeReconnectTimeout = setTimeout(connectAndListen, 15_000);
      }
    }
  });
};
