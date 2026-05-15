import { Server } from 'socket.io';
// @ts-ignore
import ZKLib from 'zkteco-js';
import { prisma } from '../lib/prisma';
import { fetchDeviceLogs, getPunchType } from './zkService';

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
  
  // Perform initial sync to catch any logs missed while server was down
  try {
    console.log('[RealtimeService] 🔄 Performing initial sync...');
    const synced = await fetchDeviceLogs();
    console.log(`[RealtimeService] ✅ Initial sync complete. ${synced} new logs.`);
  } catch (err) {
    console.error('[RealtimeService] ⚠️ Initial sync failed:', err);
  }

  connectAndListen();
};

let isConnecting = false;

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
      
      const employeeId = String(data.userId);
      const timestamp = data.attTime ? new Date(data.attTime) : new Date();
      const punchType = getPunchType(data.type);
      
      const user = await prisma.user.findUnique({
        where: { employeeId }
      });
      const employeeName = user?.name || 'N/A';

      try {
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
            punchType,
            deviceId: ZK_IP,
          }
        });

        if (io) {
          io.emit('new-attendance', {
            ...newLog,
            employeeName,
          });
          console.log(`[RealtimeService] 📡 Emitted to frontend: ${employeeName} [${punchType}]`);
        }
      } catch (err: any) {
        console.error('[RealtimeService] DB Error:', err.message);
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


