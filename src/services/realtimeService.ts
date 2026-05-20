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
let zkInstance: any;

export const initRealtimeAttendance = async (socketIo: Server) => {
  io = socketIo;
  console.log('[RealtimeService] Initializing...');
  
  const initializeWithRetry = async (retryCount = 0) => {
    try {
      // Test DB connection before starting sync
      await prisma.$queryRaw`SELECT 1`;
      
      console.log('[RealtimeService] 🔄 Performing initial sync...');
      const synced = await fetchDeviceLogs();
      console.log(`[RealtimeService] ✅ Initial sync complete. ${synced} new logs.`);
      connectAndListen();
    } catch (err) {
      console.error(`[RealtimeService] ⚠️ DB not ready or sync failed (Attempt ${retryCount + 1}):`, err);
      if (retryCount < 5) {
        console.log('[RealtimeService] Retrying initialization in 2 seconds...');
        setTimeout(() => initializeWithRetry(retryCount + 1), 2000);
      } else {
        console.error('[RealtimeService] ❌ Max retries reached. Realtime service may be degraded.');
        connectAndListen(); // Try to connect device anyway
      }
    }
  };

  initializeWithRetry();
};

let isConnecting = false;

export const runWithDeviceLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (zkInstance) {
    console.log('[RealtimeService] ⏸️ Pausing real-time listener to free up device port...');
    try {
      await zkInstance.disconnect();
    } catch (_) {}
    zkInstance = null;
  }
  // Mark as connecting/active lock to block any concurrent auto-reconnects
  isConnecting = true; 

  try {
    return await operation();
  } finally {
    console.log('[RealtimeService] ▶️ Device operation completed. Resuming real-time listener...');
    isConnecting = false;
    // Allow a small delay before reconnecting to let the device socket fully close/release
    setTimeout(connectAndListen, 1500);
  }
};

const connectAndListen = async () => {
  if (isConnecting) return;
  isConnecting = true;

  try {
    if (zkInstance) {
      try { await zkInstance.disconnect(); } catch (_) {}
      zkInstance = null;
    }

    console.log(`[RealtimeService] 🔌 Attempting to connect to ${ZK_IP}:${ZK_PORT}...`);
    zkInstance = new ZKLib(ZK_IP, ZK_PORT, ZK_TIMEOUT, ZK_INPORT);
    zkInstance.password = ZK_PASSWORD;
    zkInstance.connectionType = 'udp';

    if (zkInstance.connectionType === 'tcp') {
      await zkInstance.createSocket();
    } else {
      await zkInstance.zudp.createSocket();
    }
    
    await new Promise(r => setTimeout(r, 2000));
    await zkInstance.connect();

    console.log(`[RealtimeService] ✅ Connected to device at ${ZK_IP}`);

    zkInstance.getRealTimeLogs(async (data: any) => {
      console.log('[RealtimeService] 🕒 New Punch Received:', data);
      
      try {
        const employeeId = String(data.userId);
        const timestamp = data.attTime ? new Date(data.attTime) : new Date();
        const stateValue = data.state !== undefined && data.state !== null ? data.state : (data.type !== undefined && data.type !== null ? data.type : -1);
        
        // Wrap everything in try/catch to prevent unhandled promise rejections crashing the monolithic server
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
          // Offload socket emission from the main DB thread slightly
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

    // Keepalive / Heartbeat
    const heartbeat = setInterval(async () => {
        try {
            if (zkInstance) await zkInstance.getTime();
        } catch (e) {
            console.log('[RealtimeService] 💔 Heartbeat failed, reconnecting...');
            clearInterval(heartbeat);
            isConnecting = false;
            connectAndListen();
        }
    }, 60000);

  } catch (err: any) {
    console.error(`[RealtimeService] ❌ Connection failed: ${err.message}`);
    isConnecting = false;
    setTimeout(connectAndListen, 10000);
  }
};


