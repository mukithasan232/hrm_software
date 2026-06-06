const ZKLib = require('zkteco-js');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────
const DEVICE_IP = process.env.DEVICE_IP || '192.168.10.185';
const DEVICE_PORT = parseInt(process.env.DEVICE_PORT || '4370');
const CLOUD_WEBHOOK_URL = process.env.CLOUD_WEBHOOK_URL || 'https://hrm.fixanyphoto.com/api/attendance/device-punch';
const STATE_FILE = path.join(__dirname, 'last-sync.json');

// ─── State Management ─────────────────────────────────────────────────────
function getLastSync() {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    try {
      return JSON.parse(raw).lastSyncTimestamp || null;
    } catch(e) {
      return null;
    }
  }
  return null;
}

function updateLastSync(timestamp) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSyncTimestamp: timestamp }, null, 2));
}

// ─── Time Parsing ─────────────────────────────────────────────────────────
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
  let isoString = rawTime.includes('T') ? rawTime : rawTime.replace(' ', 'T');
  if (!isoString.includes('+') && !isoString.includes('Z')) {
      isoString += '+06:00'; // Assuming device is configured for Asia/Dhaka
  }
  return new Date(isoString);
}

// ─── Core Sync Logic ──────────────────────────────────────────────────────
async function syncPunches() {
  console.log(`\n[${new Date().toLocaleString()}] 🔄 Starting Sync Cycle...`);
  let zkInstance = null;
  
  try {
    const lastSyncStr = getLastSync();
    const lastSyncTime = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;

    console.log(`[Sync] Last sync point: ${lastSyncStr || 'Never (Full Sync)'}`);

    // Robust connection with 5-second race timeout
    console.log(`[Sync] Connecting to ZKTeco at ${DEVICE_IP}:${DEVICE_PORT}...`);
    zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);
    
    await Promise.race([
      zkInstance.createSocket().then(() => zkInstance.connect()),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Connection timeout - device offline or blocked')), 5000))
    ]);

    console.log('[Sync] ✅ Connected to device. Fetching logs...');
    
    const logsResponse = await zkInstance.getAttendances();
    const logs = Array.isArray(logsResponse?.data) ? logsResponse.data : [];
    
    if (logs.length === 0) {
      console.log('[Sync] No logs found on the device.');
      return;
    }

    // Process chronologically to maintain data integrity
    logs.sort((a, b) => new Date(a.recordTime || a.record_time).getTime() - new Date(b.recordTime || b.record_time).getTime());

    let newPunches = 0;
    let latestTimestampInBatch = lastSyncStr;

    for (const log of logs) {
      const punchDate = parseDeviceTime(log.recordTime || log.record_time);
      const punchTimeMs = punchDate.getTime();

      // Skip old punches already synced
      if (punchTimeMs > lastSyncTime) {
        newPunches++;
        
        const payload = {
          employeeId: String(log.deviceUserId || log.user_id || log.userId || log.uid),
          timestamp: punchDate.toISOString(),
          status: log.state === 1 ? 'CheckOut' : 'CheckIn' // The cloud API handles precise resolution securely
        };

        // Post securely to the Live Server
        try {
          await axios.post(CLOUD_WEBHOOK_URL, payload);
          console.log(`  -> 📡 Success: Pushed punch for Employee ID ${payload.employeeId} at ${punchDate.toISOString()}`);
          
          // Update the watermark only upon successful push
          if (!latestTimestampInBatch || punchTimeMs > new Date(latestTimestampInBatch).getTime()) {
            latestTimestampInBatch = punchDate.toISOString();
            updateLastSync(latestTimestampInBatch);
          }
        } catch (postError) {
          console.error(`  -> ❌ Failed to push to cloud for employee ${payload.employeeId}. Server unreachable or busy.`);
          // Break loop: Stop processing so we don't update the last-sync point, ensuring retry next minute
          break;
        }
      }
    }

    if (newPunches === 0) {
      console.log('[Sync] ✔ No new punches since last cycle.');
    } else {
      console.log(`[Sync] 🎉 Sync cycle complete. Forwarded new punches to production server.`);
    }

  } catch (error) {
    console.error(`[Sync Error] ❌ ${error.message}`);
  } finally {
    if (zkInstance) {
      try { await zkInstance.disconnect(); } catch (_) {}
    }
  }
}

// ─── Automation Setup ─────────────────────────────────────────────────────
console.log('================================================================');
console.log(' 🚀 Local ZKTeco Background Sync Service Started');
console.log(` 🌐 Target Device: ${DEVICE_IP}:${DEVICE_PORT}`);
console.log(` ☁️  Cloud Webhook: ${CLOUD_WEBHOOK_URL}`);
console.log(' ⏱️  Cron Schedule: Running every 1 minute');
console.log('================================================================');

// Trigger immediate first run on boot
syncPunches();

// Automate on a 1-minute interval
cron.schedule('*/1 * * * *', () => {
  syncPunches();
});
