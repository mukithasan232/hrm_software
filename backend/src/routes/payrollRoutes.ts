import express from 'express';
import { 
  generateMonthlyPayroll, 
  getAllPayrolls, 
  updatePayrollStatus 
} from '../controllers/payrollController';
import { protect, authorizeRoles } from '../middlewares/authMiddleware';

const router = express.Router();

// Admin & HR can generate and view all payrolls
router.get('/', protect, authorizeRoles('Admin', 'HR'), getAllPayrolls);
router.post('/generate', protect, authorizeRoles('Admin', 'HR'), generateMonthlyPayroll);
router.patch('/:id', protect, authorizeRoles('Admin'), updatePayrollStatus);

export default router;
