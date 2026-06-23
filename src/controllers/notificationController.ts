import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: (req as any).user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.status(200).json(notifications);
  } catch (error: any) {
    console.error('[Notification GET Error]:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    
    if (id) {
      await prisma.notification.update({
        where: { id, userId: (req as any).user.id },
        data: { read: true }
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: (req as any).user.id, read: false },
        data: { read: true }
      });
    }
    
    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
};

export const deleteNotifications = async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};

    if (id) {
      await prisma.notification.delete({
        where: { id, userId: (req as any).user.id }
      });
    } else {
      // Clear all
      await prisma.notification.deleteMany({
        where: { userId: (req as any).user.id }
      });
    }

    res.status(200).json({ message: 'Notifications deleted' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting notifications', error: error.message });
  }
};
