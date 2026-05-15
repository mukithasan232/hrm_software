import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: (req as any).user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.status(200).json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: (req as any).user.id, read: false },
      data: { read: true }
    });
    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
};

