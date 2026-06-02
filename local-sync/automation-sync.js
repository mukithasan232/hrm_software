const ZKLib = require('zkteco-js');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────
const DEVICE_IP = process.env.DEVICE_IP || '192.168.1.201';
const DEVICE_PORT = parseInt(process.env.DEVICE_PORT || '4370');
const CLOUD_WEBHOOK_URL = process.env.CLOUD_WEBHOOK_URL || 'https://hrm.fixanyphoto.com/api/attendance/device-punch';
const STATE_FILE = path.join(__dirname, 'last-sync.json');

// ─── Timezone & Format Utilities (Asia/Dhaka) ──────────────────────────────
/**
 * Custom robust helper that converts a Date object into a 12-hour formatted Bangladesh (Dhaka) string:
 * e.g., '2026-06-02 03:45:12 PM'
 */
function getDhakaLogTimestamp(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).formatToParts(date);
    
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    
    const year = map.year || '2026';
    const month = map.month || '01';
    const day = map.day || '01';
    const hour = map.hour || '12';
    const minute = map.minute || '00';
    const second = map.second || '00';
    const dayPeriod = (map.dayPeriod || 'AM').toUpperCase();
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second} ${dayPeriod}`;
  } catch (err) {
    // Fail-safe default string
    return date.toISOString();
  }
}

/**
 * Parses raw ZKTeco timestamps forcing an explicit Asia/Dhaka (+06:00) offset.
 */
function parseDeviceTime(rawTimestamp) {
  let rawTime = String(rawTimestamp).trim();
  if (rawTimestamp instanceof Date) {
    const yyyy = rawTimestamp.getFullYear();
    const MM = String(rawTimestamp.getMonth() + 1).padStart(2, '0');
    const dd = String(rawTimestamp.getDate()).padStart(2, '0');
    const hh = String(rawTimestamp.getHours()).padStart(2, '0');
    const mm = String(rawTimestamp.getMinutes()).padStart(2, '0');
    const ss = String(rawTimestamp.getSeconds()).padStart(2, '0');
    rawTime = `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
  }
  
  // Format MM/DD/YYYY to YYYY-MM-DD if returned differently, replace spaces with T
  let isoString = rawTime.includes('T') ? rawTime : rawTime.replace(' ', 'T');
  
  // Strip any existing offset
  if (isoString.includes('+')) {
    isoString = isoString.split('+')[0];
  }
  if (isoString.endsWith('Z')) {
    isoString = isoString.slice(0, -1);
  }
  
  // Force explicit Bangladesh offset (+06:00)
  isoString += '+06:00';
  return new Date(isoString);
}

// ─── State Management ─────────────────────────────────────────────────────
function getLastSync() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw).lastSyncTimestamp || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function updateLastSync(timestamp) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSyncTimestamp: timestamp }, null, 2));
}

// ─── Clean Slate Boot Mechanism ───────────────────────────────────────────
(function cleanSlateBoot() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
      console.log(`[${getDhakaLogTimestamp()}] 🧹 [BOOT] Clean slate active. Successfully flushed stale last-sync.json watermark.`);
    } catch (err) {
      console.error(`[${getDhakaLogTimestamp()}] ⚠️ [BOOT] Warning: Could not purge last-sync.json during boot: ${err.message}`);
    }
  } else {
    console.log(`[${getDhakaLogTimestamp()}] 🧹 [BOOT] Clean slate initialized. Ready for fresh attendance watermark logs.`);
  }
})();

// ─── Visual ASCII Status Dashboard Summary ─────────────────────────────────
function printDashboard(status, totalPulled, newSynced, lastWatermark) {
  const currentDhaka = getDhakaLogTimestamp();
  const watermarkDisp = lastWatermark ? getDhakaLogTimestamp(new Date(lastWatermark)) : 'Never (Full Sync)';
  const border = '┌────────────────────────────────────────────────────────┐';
  const divider = '├────────────────────────────────────────────────────────┤';
  const bottom = '└────────────────────────────────────────────────────────┘';
  
  console.log('\n' + border);
  console.log(`│  🔄  ZKTeco Biometric Attendance Sync Summary           │`);
  console.log(divider);
  console.log(`│  ⏰  Sync Timestamp   : ${currentDhaka.padEnd(30)} │`);
  console.log(`│  🌐  Device IP        : ${(DEVICE_IP + ':' + DEVICE_PORT).padEnd(30)} │`);
  console.log(`│  📡  Status           : ${status.padEnd(30)} │`);
  console.log(`│  📊  Total Logs Pulled: ${String(totalPulled).padEnd(30)} │`);
  console.log(`│  🆕  New Logs Synced  : ${String(newSynced).padEnd(30)} │`);
  console.log(`│  💾  Last Watermark   : ${watermarkDisp.padEnd(30)} │`);
  console.log(bottom + '\n');
}

// ─── Core Pipeline Sync Logic ─────────────────────────────────────────────
async function syncPunches() {
  console.log(`[${getDhakaLogTimestamp()}] 🔄 Starting Sync Cycle...`);
  let zkInstance = null;
  let totalLogsCount = 0;
  let newPunchesCount = 0;
  let latestTimestampInBatch = getLastSync();
  
  try {
    const lastSyncStr = latestTimestampInBatch;
    const lastSyncTime = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;
    
    // Connect to the biometric machine with 5-second socket timeout race
    console.log(`[${getDhakaLogTimestamp()}] 🌐 Connecting to ZKTeco at ${DEVICE_IP}:${DEVICE_PORT}...`);
    zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);
    
    await Promise.race([
      zkInstance.createSocket().then(() => zkInstance.connect()),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Connection timeout - device offline or port blocked')), 5000))
    ]);

    console.log(`[${getDhakaLogTimestamp()}] ✅ Connected to ZKTeco device. Retrieving logs...`);
    
    const logsResponse = await zkInstance.getAttendances();
    const logs = Array.isArray(logsResponse?.data) ? logsResponse.data : [];
    totalLogsCount = logs.length;
    
    if (totalLogsCount === 0) {
      printDashboard('COMPLETED (Empty logs)', 0, 0, latestTimestampInBatch);
      return;
    }
    
    // Sort logs chronologically to preserve insertion watermarks
    logs.sort((a, b) => {
      const timeA = parseDeviceTime(a.recordTime || a.record_time).getTime();
      const timeB = parseDeviceTime(b.recordTime || b.record_time).getTime();
      return timeA - timeB;
    });

    let networkFailure = false;
    for (const log of logs) {
      const punchDate = parseDeviceTime(log.recordTime || log.record_time);
      const punchTimeMs = punchDate.getTime();
      
      // Filter out punches already synced using safe tracking watermark
      if (punchTimeMs > lastSyncTime) {
        const punch = {
          userId: String(log.deviceUserId || log.userId || log.user_id || log.uid || ''),
          timestamp: punchDate.toISOString(),
          attendanceStatus: String(log.attendanceStatus || (log.state === 1 ? 'CheckOut' : 'CheckIn'))
        };
        
        const payload = {
          employeeId: punch.userId,
          timestamp: punch.timestamp,
          status: punch.attendanceStatus
        };
        
        try {
          // Push securely to the live web portal with a 5-second query timeout
          await axios.post(CLOUD_WEBHOOK_URL, payload, { timeout: 5000 });
          newPunchesCount++;
          console.log(`[${getDhakaLogTimestamp()}] 📡 [Success] Pushed Employee ID ${payload.employeeId} punched at ${getDhakaLogTimestamp(punchDate)}`);
          
          // Update tracking watermark state file on successful transaction
          if (!latestTimestampInBatch || punchTimeMs > new Date(latestTimestampInBatch).getTime()) {
            latestTimestampInBatch = punchDate.toISOString();
            updateLastSync(latestTimestampInBatch);
          }
        } catch (postError) {
          console.error(`[${getDhakaLogTimestamp()}] ❌ [POST Error] Failed pushing punch for employee ${payload.employeeId}: ${postError.message}`);
          networkFailure = true;
          break; // Halt iteration to preserve the state pointer and avoid duplicate sync gaps
        }
      }
    }
    
    const cycleStatus = networkFailure ? 'HALTED (Network Error)' : 'COMPLETED';
    printDashboard(cycleStatus, totalLogsCount, newPunchesCount, latestTimestampInBatch);
    
  } catch (error) {
    console.error(`[${getDhakaLogTimestamp()}] ❌ [Sync Error] ${error.message}`);
    printDashboard(`FAILED (${error.message})`, totalLogsCount, newPunchesCount, latestTimestampInBatch);
  } finally {
    if (zkInstance) {
      try {
        await zkInstance.disconnect();
        console.log(`[${getDhakaLogTimestamp()}] 🔌 [Socket] Connection to ZKTeco closed cleanly.`);
      } catch (_) {}
    }
  }
}

// ─── Service Startup Logs ──────────────────────────────────────────────────
console.log('================================================================');
console.log(' 🚀 Biometric Background Sync Service Daemon Booting Up');
console.log(` ⏰ System Boot Time : ${getDhakaLogTimestamp()}`);
console.log(` 🌐 Target ZK Device : ${DEVICE_IP}:${DEVICE_PORT}`);
console.log(` ☁️  Cloud Webhook    : ${CLOUD_WEBHOOK_URL}`);
console.log(' ⏱️  Cron Sync Cycle  : Running exactly every 1 minute');
console.log('================================================================\n');

// Perform first run immediately on startup
syncPunches();

// Schedule continuous job every minute
cron.schedule('*/1 * * * *', () => {
  syncPunches();
});
