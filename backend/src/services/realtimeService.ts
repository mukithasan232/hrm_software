import { Server } from 'socket.io';
// @ts-ignore
import ZKLib from 'zkteco-js';
import { AttendanceLog } from '../models/AttendanceLog';
import { User } from '../models/User';
import { fetchDeviceLogs } from './zkService';

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


const resolvePunchType = (type: number): 'CheckIn' | 'CheckOut' | 'Unknown' => {
  if (type === 0) return 'CheckIn';
  if (type === 1) return 'CheckOut';
  return 'Unknown';
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
    
    await new Promise(r => setTimeout(r, 2000)); // Increased wait for socket
    await zkInstance.connect();

    console.log(`[RealtimeService] ✅ Connected to device at ${ZK_IP}`);

    zkInstance.getRealTimeLogs(async (data: any) => {
      console.log('[RealtimeService] 🕒 New Punch Received:', data);
      
      const employeeId = String(data.userId);
      const timestamp = data.attTime ? new Date(data.attTime) : new Date();
      
      let punchType: 'CheckIn' | 'CheckOut' | 'Unknown' = 'Unknown';
      if (data.type === 0) punchType = 'CheckIn';
      else if (data.type === 1) punchType = 'CheckOut';
      else punchType = 'CheckIn';
      
      const user = await User.findOne({ employeeId });
      const employeeName = user?.name || 'N/A';

      try {
        const newLog = await AttendanceLog.create({
          employeeId,
          timestamp,
          punchType,
          deviceId: ZK_IP,
        });

        if (io) {
          io.emit('new-attendance', {
            ...newLog.toObject(),
            employeeName,
          });
        }
      } catch (err: any) {
        if (err.code !== 11000) {
          console.error('[RealtimeService] DB Error:', err.message);
        }
      }
    });

    // Keepalive / Heartbeat
    const heartbeat = setInterval(async () => {
        try {
            await zkInstance.getTime(); // Simple command to check if alive
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
    // Retry after 10 seconds
    setTimeout(connectAndListen, 10000);
  }
};

