import { Server } from 'socket.io';
// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';
import { getPunchType, resolvePunchType, parseDhakaTimestamp } from './zkService';
import bcrypt from 'bcryptjs';

// ─── Device Configuration (strictly from env — no hardcoded fallbacks) ──────
const ZK_IP       = process.env.ZK_DEVICE_IP;
const ZK_PORT     = parseInt(process.env.ZK_DEVICE_PORT || '4370');
const ZK_TIMEOUT  = 10000; // Reduced to 10s — enough for LAN, fast enough to fail quickly
const ZK_INPORT   = 0;
const ZK_PASSWORD = parseInt(process.env.ZK_COMM_KEY || '0');

// ─── Connection Timeout ──────────────────────────────────────────────────────
// How long a single connect() call is allowed to run before we abort.
const CONNECT_TIMEOUT_MS = 5000;

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
  console.log('[RealtimeService] ✅ Initialized (socket.io ready). ZKTeco connection is deferred until manual sync.)');
  // ⚠️  NO automatic device connection here.
  // The previous `initializeWithRetry()` call has been intentionally removed
  // because it caused startup crashes when the device was unreachable.
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
        try { await zkInstance.disconnect(); } catch (_) {}
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
  if (isConnecting)      return;

  // If ZK_IP is not configured, silently skip — no crashes.
  if (!ZK_IP) {
    console.warn('[RealtimeService] ⚠️ ZK_DEVICE_IP not set. Realtime listener skipped.');
    return;
  }

  isConnecting = true;

  deviceMutex = deviceMutex.then(async () => {
    if (!isListenerActive) { isConnecting = false; return; }

    try {
      // Clean up any stale connection
      if (zkInstance) {
        try { await zkInstance.disconnect(); } catch (_) {}
        zkInstance = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      console.log(`[RealtimeService] 🔌 Connecting to ${ZK_IP}:${ZK_PORT} for realtime punches...`);
      const zk = new ZKLib(ZK_IP, ZK_PORT, ZK_TIMEOUT, ZK_INPORT);
      zk.password   = ZK_PASSWORD;
      zk.connectionType = 'udp';

      // Create UDP socket
      await zk.zudp.createSocket();
      await new Promise(r => setTimeout(r, 500));

      // Strict 5-second timeout on connect() — prevents indefinite hang
      await Promise.race([
        zk.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout — device unreachable')), CONNECT_TIMEOUT_MS)
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
          const deviceEmpId   = String(data.userId);
          const parsedTimestamp = parseDhakaTimestamp(data.attTime ?? new Date());

          if (isNaN(parsedTimestamp.getTime())) {
            console.error('[RealtimeService] ❌ Invalid timestamp:', data.attTime);
            return;
          }

          let user = await prisma.user.findUnique({ where: { employeeId: deviceEmpId } });

          if (!user) {
            const name            = `User ${deviceEmpId}`;
            const normalizedEmail = `user${deviceEmpId}-${Date.now()}@hrm.test`;
            const hashedPassword  = await bcrypt.hash('password123', 10);
            user = await prisma.user.create({
              data: {
                employeeId: deviceEmpId,
                name,
                email: normalizedEmail,
                password: hashedPassword,
                baseSalary: 0,
                isActive:   true,
                documents:  {},
              },
            });
          }

          const employeeId   = user.id;
          const employeeName = user.name;
          const punchType    = await resolvePunchType(employeeId, parsedTimestamp, data);

          const newLog = await prisma.attendanceLog.upsert({
            where: { employeeId_timestamp: { employeeId, timestamp: parsedTimestamp } },
            update: { punchType: punchType as any },
            create: { employeeId, timestamp: parsedTimestamp, punchType: punchType as any, deviceId: ZK_IP! },
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
          heartbeatInterval  = null;
          zkInstance         = null;
          isConnecting       = false;
          if (isListenerActive) {
            if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
            activeReconnectTimeout = setTimeout(connectAndListen, 5000);
          }
        }
      }, 60_000);

      isConnecting = false;
    } catch (err: any) {
      // ── Graceful failure — log and schedule a delayed retry, never crash ──
      console.error(`[RealtimeService] ❌ Connection failed: ${err.message}`);
      isConnecting = false;
      zkInstance   = null;
      if (isListenerActive) {
        if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
        // Back off 15 seconds before retrying so we don't spam the device
        activeReconnectTimeout = setTimeout(connectAndListen, 15_000);
      }
    }
  });
};
