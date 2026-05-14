import express from 'express';
import { getPendingPayroll, generatePayroll } from '../controllers/payrollController';
import { protect, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();
router.get('/', protect, authorizeRoles('Admin', 'HR'), getPendingPayroll);
router.get('/pending', protect, authorizeRoles('Admin', 'HR'), getPendingPayroll);
router.post('/generate', protect, authorizeRoles('Admin', 'HR'), generatePayroll);

export default router;
