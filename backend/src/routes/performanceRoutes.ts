import express from 'express';
import { getPerformanceStats, rateEmployee, calculateEOTM, getLatestEOTM } from '../controllers/performanceController';
import { protect, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/eotm/latest', protect, getLatestEOTM);
router.post('/eotm', protect, authorizeRoles('Admin', 'Manager', 'HR'), calculateEOTM);
router.get('/:employeeId', protect, getPerformanceStats);
router.post('/rate', protect, authorizeRoles('Admin', 'Manager', 'HR'), rateEmployee);

export default router;
