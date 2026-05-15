import express from 'express';
import {
  syncDeviceLogs,
  syncLive,
  getDeviceStatus,
  fetchDeviceUsers,
  getAttendanceLogs,
  createManualLog,
} from '../controllers/attendanceController';
import { protect, adminOnly, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Manual Entry
router.post('/manual',        protect, authorizeRoles('Admin', 'HR'), createManualLog);

// Existing (cron-safe)

router.post('/sync',          protect, adminOnly, syncDeviceLogs);

// New live-sync endpoint (Admin-only, your requirement)
router.post('/sync-live',     protect, adminOnly, syncLive);

// Device health + user endpoints
router.get('/device-status',  protect, adminOnly, getDeviceStatus);
router.get('/device-users',   protect, adminOnly, fetchDeviceUsers);
router.get('/test-users',     protect, adminOnly, fetchDeviceUsers); // Temporary test route

// Logs — Admin/HR can view
router.get('/logs',           protect, authorizeRoles('Admin', 'HR', 'Manager'), getAttendanceLogs);

export default router;
