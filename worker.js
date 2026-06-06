/**
 * worker.js
 * Holistic Audited Worker for ZKTeco K60 biometric data sync.
 */

const ZKLib = require('node-zklib');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEVICE_IP = '192.168.10.185';
const DEVICE_PORT = 4370;
const TIMEOUT_MS = 8000;

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

        const logsResponse = await zkInstance.getAttendances();
        const logs = Array.isArray(logsResponse?.data) ? logsResponse.data : [];

        if (logs.length === 0) {
            console.log('[Info] No new logs found on the device.');
            return;
        }

        console.log(`[Info] Fetched ${logs.length} logs. Processing...`);

        // AUDIT FIX: Fetch all active users from DB to map deviceUserId to User.id (UUID)
        // because AttendanceLog.employeeId references User.id in schema.prisma.
        const users = await prisma.user.findMany({ select: { id: true, employeeId: true } });
        const userMap = new Map(users.map(u => [String(u.employeeId), u.id]));

        const mappedLogs = [];
        let missingUsersCount = 0;

        for (const log of logs) {
            const zkTecoUserId = String(log.deviceUserId || log.uid);
            const userUuid = userMap.get(zkTecoUserId);

            if (!userUuid) {
                // If the user doesn't exist in MariaDB, skip to avoid Foreign Key crash
                missingUsersCount++;
                continue;
            }

            mappedLogs.push({
                employeeId: userUuid, // MUST BE UUID based on schema relation
                timestamp: new Date(log.recordTime),
                deviceId: DEVICE_IP,
                punchType: log.state !== undefined ? String(log.state) : 'UNKNOWN'
            });
        }

        if (missingUsersCount > 0) {
            console.warn(`[Warn] Skipped ${missingUsersCount} logs because the ZKTeco User ID does not match any 'employeeId' in MariaDB.`);
        }

        if (mappedLogs.length === 0) {
            console.log('[Info] No valid logs to insert after filtering unknown users.');
            return;
        }

        console.log(`[Debug] Attempting to insert ${mappedLogs.length} mapped logs...`);
        if (mappedLogs.length > 0) {
            console.log(`[Debug] Sample mapped record:`, mappedLogs[0]);
        }

        const result = await prisma.attendanceLog.createMany({
            data: mappedLogs,
            skipDuplicates: true
        });

        console.log(`[Success] Sync complete. Inserted ${result.count} new attendance logs.`);

    } catch (error) {
        console.error(`[Error] Device unreachable or sync failed:`, error.message);
    } finally {
        try {
            await zkInstance.disconnect();
        } catch (err) {}
    }
}

// ─── EXECUTION STRATEGY ───

// 1. Heartbeat to prove the worker is alive in Coolify logs
cron.schedule('*/5 * * * *', () => {
    console.log(`[Heartbeat] Worker is active and healthy. Next sync running shortly...`);
});

// 2. The actual sync job
const syncTask = cron.schedule('*/5 * * * *', () => {
    syncBiometricData();
});

// Initial run
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
