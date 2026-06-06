/**
 * worker.js
 * Production-grade background worker for ZKTeco K60 biometric data sync.
 * Executes within a Coolify/PM2 Next.js environment.
 */

const ZKLib = require('node-zklib');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client instance
const prisma = new PrismaClient();

// --- Configuration ---
const DEVICE_IP = '192.168.10.185';
const DEVICE_PORT = 4370;
const TIMEOUT_MS = 8000;

/**
 * Core function to pull logs from ZKTeco device and bulk-insert into MariaDB.
 */
async function syncBiometricData() {
    console.log(`[${new Date().toISOString()}] Starting ZKTeco data sync...`);

    // Initialize the ZKLib instance
    const zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);

    try {
        // 1. Network Resilience & Timeout Handling (CRITICAL)
        // Prevent the Node.js event loop from hanging by wrapping connection in a Promise.race
        await Promise.race([
            zkInstance.createSocket().then(() => zkInstance.connect()),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS)
            )
        ]);

        console.log('[Info] Connected to ZKTeco device successfully.');

        // Fetch the attendance logs from the device
        const logsResponse = await zkInstance.getAttendances();
        const logs = Array.isArray(logsResponse?.data) ? logsResponse.data : [];

        if (logs.length === 0) {
            console.log('[Info] No new logs found on the device.');
            return;
        }

        console.log(`[Info] Fetched ${logs.length} logs. Mapping to database schema...`);

        // 2. Map raw ZKTeco logs to the Prisma AttendanceLog model
        const mappedLogs = logs.map(log => ({
            employeeId: String(log.deviceUserId || log.uid),
            timestamp: new Date(log.recordTime),
            deviceId: DEVICE_IP,
            punchType: log.state !== undefined ? String(log.state) : 'UNKNOWN'
        }));

        // 3. Prisma Schema & Upsert Logic
        // Lightning-fast, conflict-free bulk insertions. 
        // Relies on the @@unique([employeeId, timestamp]) constraint in schema.prisma.
        const result = await prisma.attendanceLog.createMany({
            data: mappedLogs,
            skipDuplicates: true
        });

        console.log(`[Success] Sync complete. Inserted ${result.count} new attendance logs.`);

    } catch (error) {
        // Catch-all for network timeouts or device unreachability
        // Logs cleanly without crashing the cron scheduler
        console.warn(`[Warn] Device unreachable or sync failed: ${error.message}`);
    } finally {
        // 4. Memory Management (Zero Socket Leaks)
        // ALWAYS release the TCP socket to prevent crashing the physical hardware
        try {
            await zkInstance.disconnect();
        } catch (disconnectError) {
            console.error(`[Error] Failed to disconnect socket properly: ${disconnectError.message}`);
        }
    }
}

// 5. Execution Strategy
// Schedule the background worker to run every 5 minutes (300,000 ms)
const syncTask = cron.schedule('*/5 * * * *', () => {
    syncBiometricData();
});

// Trigger an immediate fetch cycle when the script first boots up
syncBiometricData();

// 6. Graceful Shutdown
// Ensures database connections are closed and jobs are halted gracefully on Coolify/PM2 restart
const gracefulShutdown = async (signal) => {
    console.log(`\n[Info] Received ${signal}. Shutting down worker gracefully...`);

    syncTask.stop(); // Stop the cron scheduler
    await prisma.$disconnect(); // Cleanly disconnect Prisma Client

    process.exit(0);
};

// Listen for termination signals from the process manager
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

console.log(`[Info] ZKTeco background worker initialized. Target: ${DEVICE_IP}:${DEVICE_PORT}`);
