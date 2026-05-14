import express from 'express';
import { applyLeave, getLeaves, updateLeaveStatus } from '../controllers/leaveController';
import { protect, authorizeRoles } from '../middlewares/authMiddleware';
import { leaveUpload } from '../config/leaveUpload';

const router = express.Router();

router.post('/apply', protect, authorizeRoles('Executive', 'Manager', 'HR', 'Admin'), leaveUpload.single('attachment'), applyLeave);
router.get('/all', protect, getLeaves); // Handles internal RBAC in controller
router.patch('/status/:id', protect, authorizeRoles('HR', 'Manager', 'Admin'), updateLeaveStatus);

export default router;
