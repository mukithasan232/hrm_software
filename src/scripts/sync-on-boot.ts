import { getDeviceAttendance, getDeviceUsers, processRawDeviceLogs } from '../services/zkService';

async function syncOnBoot() {
  try {
    console.log('🔄 [Boot Sync] Starting full ZKTeco synchronization...');
    
    // 1. Fetch Users from Device
    console.log('👥 [Boot Sync] Fetching all users from device...');
    const users = await getDeviceUsers();
    console.log(`✅ [Boot Sync] Found ${users.length} users on the device.`);
    if (users.length > 0) {
      users.forEach(u => console.log(`   - ID: ${u.userId} | Name: ${u.name}`));
    }

    // 2. Fetch Attendance Logs
    console.log('📥 [Boot Sync] Fetching new attendance logs...');
    const result = await getDeviceAttendance();
    console.log(`✅ [Boot Sync] Attendance fetched. Synced: ${result.synced}, Skipped: ${result.skipped}, Total: ${result.total}`);

    // 3. Process any mapped RawDeviceLogs
    console.log('⚙️ [Boot Sync] Processing raw device logs into attendance...');
    const processed = await processRawDeviceLogs();
    console.log(`✅ [Boot Sync] Processed ${processed} raw logs.`);

    process.exit(0);
  } catch (error: any) {
    console.error(`❌ [Boot Sync] Failed to sync biometric data: ${error.message || error}`);
    process.exit(1);
  }
}

syncOnBoot();
