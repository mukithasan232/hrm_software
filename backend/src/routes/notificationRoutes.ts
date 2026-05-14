import express from 'express';
import { getNotifications, markAsRead } from '../controllers/notificationController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', protect, getNotifications);
router.post('/read', protect, markAsRead);

export default router;
