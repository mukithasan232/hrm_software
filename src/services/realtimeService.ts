import { Server } from 'socket.io';
// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';
import { fetchDeviceLogs, getPunchType, resolvePunchType } from './zkService';

const ZK_IP = process.env.ZK_DEVICE_IP || '192.168.10.185';
const ZK_PORT = parseInt(process.env.ZK_DEVICE_PORT || '4370');
const ZK_TIMEOUT = 40000;
const ZK_INPORT = 0;
const ZK_PASSWORD = parseInt(process.env.ZK_COMM_KEY || '0');

let io: Server;
let zkInstance: any = null;
let isConnecting = false;
let isListenerActive = false;
let activeReconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Promise-based Mutex to completely serialize all ZKTeco socket connections,
// disconnections, and commands. This guarantees no overlapping connections.
let deviceMutex = Promise.resolve();

export const initRealtimeAttendance = async (socketIo: Server) => {
  io = socketIo;
  console.log('[RealtimeService] Initializing...');
  
  const initializeWithRetry = async (retryCount = 0) => {
    try {
      // Test DB connection before starting sync
      await prisma.$queryRaw`SELECT 1`;
      
      console.log('[RealtimeService] 🔄 Performing initial sync...');
      isListenerActive = true;
      const synced = await runWithDeviceLock(() => fetchDeviceLogs());
      console.log(`[RealtimeService] ✅ Initial sync complete. ${synced} new logs.`);
      connectAndListen();
    } catch (err) {
      console.error(`[RealtimeService] ⚠️ DB not ready or sync failed (Attempt ${retryCount + 1}):`, err);
      if (retryCount < 5) {
        console.log('[RealtimeService] Retrying initialization in 2 seconds...');
        setTimeout(() => initializeWithRetry(retryCount + 1), 2000);
      } else {
        console.error('[RealtimeService] ❌ Max retries reached. Realtime service may be degraded.');
        isListenerActive = true;
        connectAndListen(); // Try to connect device anyway
      }
    }
  };

  initializeWithRetry();
};

export const runWithDeviceLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    deviceMutex = deviceMutex.then(async () => {
      console.log('[RealtimeService] 🔒 Mutex acquired for operation.');
      
      // 1. Temporarily pause the real-time listener and clear any pending reconnects
      isListenerActive = false;
      if (activeReconnectTimeout) {
        clearTimeout(activeReconnectTimeout);
        activeReconnectTimeout = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      if (zkInstance) {
        console.log('[RealtimeService] ⏸️ Disconnecting real-time listener to free up device port...');
        try {
          await zkInstance.disconnect();
        } catch (_) {}
        zkInstance = null;
      }

      // Allow a brief moment for the port/socket to be fully released by the OS
      await new Promise(r => setTimeout(r, 1500));

      try {
        const result = await operation();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        // 2. Schedule resuming the real-time listener
        isListenerActive = true;
        isConnecting = false;
        console.log('[RealtimeService] 🔓 Mutex released. Resuming real-time listener in 2s...');
        if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
        activeReconnectTimeout = setTimeout(connectAndListen, 2000);
      }
    });
  });
};

const connectAndListen = async () => {
  if (!isListenerActive) return;
  if (isConnecting) return;
  isConnecting = true;

  deviceMutex = deviceMutex.then(async () => {
    if (!isListenerActive) {
      isConnecting = false;
      return;
    }

    try {
      if (zkInstance) {
        try { await zkInstance.disconnect(); } catch (_) {}
        zkInstance = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      console.log(`[RealtimeService] 🔌 Attempting to connect to ${ZK_IP}:${ZK_PORT}...`);
      const zk = new ZKLib(ZK_IP, ZK_PORT, ZK_TIMEOUT, ZK_INPORT);
      zk.password = ZK_PASSWORD;
      zk.connectionType = 'udp';

      if (zk.connectionType === 'tcp') {
        await zk.createSocket();
      } else {
        await zk.zudp.createSocket();
      }
      
      await new Promise(r => setTimeout(r, 1500));
      await zk.connect();

      zkInstance = zk;
      console.log(`[RealtimeService] ✅ Connected to device at ${ZK_IP}`);

      zkInstance.getRealTimeLogs(async (data: any) => {
        console.log('[RealtimeService] 🕒 New Punch Received:', data);
        
        try {
          const employeeId = String(data.userId);
          const timestamp = data.attTime ? new Date(data.attTime) : new Date();
          const stateValue = data.state !== undefined && data.state !== null ? data.state : (data.type !== undefined && data.type !== null ? data.type : -1);
          
          const punchType = await resolvePunchType(employeeId, timestamp, stateValue);
          
          const user = await prisma.user.findUnique({
            where: { employeeId }
          });
          const employeeName = user?.name || 'N/A';

          const newLog = await prisma.attendanceLog.upsert({
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
            }
          });

          if (io) {
            setImmediate(() => {
              io.emit('new-attendance', {
                ...newLog,
                employeeName,
              });
              console.log(`[RealtimeService] 📡 Emitted to frontend: ${employeeName} [${punchType}]`);
            });
          }
        } catch (err: any) {
          console.error('[RealtimeService] ❌ DB/Operation Error in realtime loop:', err.message);
        }
      });

      // Heartbeat/Keepalive
      heartbeatInterval = setInterval(async () => {
        try {
          if (zkInstance) await zkInstance.getTime();
        } catch (e) {
          console.log('[RealtimeService] 💔 Heartbeat failed, reconnecting...');
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          isConnecting = false;
          zkInstance = null;
          if (isListenerActive) {
            if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
            activeReconnectTimeout = setTimeout(connectAndListen, 5000);
          }
        }
      }, 60000);

      isConnecting = false;
    } catch (err: any) {
      console.error(`[RealtimeService] ❌ Connection failed: ${err.message}`);
      isConnecting = false;
      zkInstance = null;
      if (isListenerActive) {
        if (activeReconnectTimeout) clearTimeout(activeReconnectTimeout);
        activeReconnectTimeout = setTimeout(connectAndListen, 10000);
      }
    }
  });
};



