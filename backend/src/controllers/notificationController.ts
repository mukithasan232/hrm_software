import { Request, Response } from 'express';
import { Notification } from '../models/Notification';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: (req as any).user.id }).sort({ createdAt: -1 }).limit(20);
    res.status(200).json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    await Notification.updateMany({ userId: (req as any).user.id, read: false }, { read: true });
    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
};
