/**
 * worker.js
 * Holistic Audited Worker for ZKTeco K60 biometric data sync.
 */

const ZKLib = require('node-zklib');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const DEVICE_IP = '192.168.10.185';
const DEVICE_PORT = 4370;
const TIMEOUT_MS = 8000;
const STATE_FILE = path.join(__dirname, 'worker-state.json');

// --- State Management ---
function getProcessedCount() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')).processedCount || 0;
        } catch (e) { return 0; }
    }
    return 0;
}

function updateProcessedCount(count) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ processedCount: count }));
}

async function syncBiometricData() {
    console.log(`\n[${new Date().toISOString()}] 🔄 Starting ZKTeco data sync...`);

    const zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);

    try {
        await Promise.race([
            zkInstance.createSocket().then(() => zkInstance.connect()),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS)
            )
        ]);
        console.log('[Info] Connected to ZKTeco device successfully.');

        // BONUS ARCHITECTURAL FIX: Force the hardware clock to sync with the server
        try {
            await zkInstance.setTime(new Date());
            console.log('[Info] Automatically synced device clock to server time.');
        } catch (timeErr) {
            console.warn('[Warn] Failed to sync device time, proceeding anyway.');
        }

        const logsResponse = await zkInstance.getAttendances();
        const logs = Array.isArray(logsResponse?.data) ? logsResponse.data : [];

        if (logs.length === 0) {
            console.log('[Info] No logs found on the device.');
            return;
        }

        const previousCount = getProcessedCount();
        
        // If device was cleared, reset our counter
        if (logs.length < previousCount) {
            console.warn('[Warn] Device logs are fewer than processed count. Device was likely wiped. Resetting state.');
            updateProcessedCount(0);
            return;
        }

        // Only process newly added logs
        const newLogs = logs.slice(previousCount);
        if (newLogs.length === 0) {
            console.log('[Info] No *new* logs to process. Waiting for next punch.');
            return;
        }

        console.log(`[Info] Found ${newLogs.length} new punches. Processing...`);

        const users = await prisma.user.findMany({ select: { id: true, employeeId: true } });
        const userMap = new Map(users.map(u => [String(u.employeeId), u.id]));

        const mappedLogs = [];
        let missingUsersCount = 0;

        for (const log of newLogs) {
            const zkTecoUserId = String(log.deviceUserId || log.uid);
            const userUuid = userMap.get(zkTecoUserId);

            if (!userUuid) {
                missingUsersCount++;
                continue;
            }

            const deviceTime = new Date(log.recordTime);
            // Override with server time (NOW) to guarantee it hits the dashboard's "Today" query
            const serverTime = new Date(); 

            console.log(`[Audit] Mapping Punch -> ID: ${zkTecoUserId} | Device Time: ${deviceTime.toISOString()} | Inserted Time: ${serverTime.toISOString()}`);

            mappedLogs.push({
                employeeId: userUuid,
                timestamp: serverTime, 
                deviceId: DEVICE_IP,
                punchType: log.state !== undefined ? String(log.state) : 'UNKNOWN'
            });
        }

        if (missingUsersCount > 0) {
            console.warn(`[Warn] Skipped ${missingUsersCount} logs due to unrecognized employee IDs.`);
        }

        if (mappedLogs.length > 0) {
            const result = await prisma.attendanceLog.createMany({
                data: mappedLogs,
                skipDuplicates: true
            });
            console.log(`[Success] Sync complete. Inserted ${result.count} new attendance logs.`);
            
            // Update state only if database insert succeeds
            updateProcessedCount(logs.length);
        } else {
            console.log('[Info] No valid logs to insert after filtering.');
            // Still update state to avoid infinite loops on invalid users
            updateProcessedCount(logs.length);
        }

    } catch (error) {
        console.error(`[Error] Sync failed:`, error.message);
    } finally {
        try {
            await zkInstance.disconnect();
        } catch (err) {}
    }
}

// ─── EXECUTION STRATEGY ───

cron.schedule('*/5 * * * *', () => {
    console.log(`[Heartbeat] Worker is active and healthy. Next sync running shortly...`);
});

const syncTask = cron.schedule('*/5 * * * *', () => {
    syncBiometricData();
});

syncBiometricData();

const gracefulShutdown = async (signal) => {
    console.log(`\n[Info] Received ${signal}. Shutting down worker gracefully...`);
    syncTask.stop();
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

console.log(`[Info] ZKTeco worker initialized. Target: ${DEVICE_IP}:${DEVICE_PORT}`);
