import { getDeviceAttendance } from '../services/zkService';

async function syncOnBoot() {
  try {
    console.log('🔄 [Boot Sync] Starting biometric data sync...');
    const result = await getDeviceAttendance();
    console.log(`✅ [Boot Sync] Biometric data successfully synced on container startup. Synced: ${result.synced}, Skipped: ${result.skipped}, Total: ${result.total}`);
    process.exit(0);
  } catch (error: any) {
    console.error(`❌ [Boot Sync] Failed to sync biometric data: ${error.message}`);
    process.exit(1);
  }
}

syncOnBoot();
