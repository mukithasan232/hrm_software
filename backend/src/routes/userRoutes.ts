import express from 'express';
import {
  getEmployees, getProfile, updateProfile, changePassword,
  updateEmployee, createEmployee, toggleEmployeeStatus
} from '../controllers/userController';
import { protect, authorizeRoles } from '../middlewares/authMiddleware';
import { upload } from '../config/upload';

const router = express.Router();

router.get('/',                protect, authorizeRoles('Admin', 'HR', 'Manager'), getEmployees);
router.get('/profile/me',      protect, getProfile);
router.put('/profile/me',      protect, upload.single('avatar'), updateProfile);
router.put('/profile/password',protect, changePassword);
router.post('/',               protect, authorizeRoles('Admin', 'HR'), createEmployee);
router.put('/:id',             protect, authorizeRoles('Admin', 'HR'), updateEmployee);
router.patch('/:id/toggle',    protect, authorizeRoles('Admin', 'HR'), toggleEmployeeStatus);

export default router;
