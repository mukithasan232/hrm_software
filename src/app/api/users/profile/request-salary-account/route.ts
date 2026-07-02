export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';
import { eventEmitter } from '@/lib/eventEmitter';

export const POST = wrapHandler(async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find admins to notify
    const admins = await prisma.user.findMany({
      where: {
        customDesignation: { name: { in: ['Admin', 'Super Admin', 'System Administrator', 'HR'] } }
      }
    });

    const notifications = admins.map((admin: any) => ({
      userId: admin.id,
      titleEn: 'Salary Account Request',
      titleBn: 'বেতন অ্যাকাউন্টের অনুরোধ',
      messageEn: `${user.name} (${user.employeeId}) has requested a salary account to be set up.`,
      messageBn: `${user.name} একটি স্যালারি অ্যাকাউন্টের জন্য অনুরোধ করেছেন।`,
      type: 'SYSTEM'
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
      notifications.forEach((n) => eventEmitter.emit('new-notification', { ...n, id: Math.random().toString(36).substring(7), createdAt: new Date() }));
    }

    return res.status(200).json({ message: 'Request sent to admin successfully.' });
  } catch (error: any) {
    console.error('Error requesting salary account:', error);
    return res.status(500).json({ message: 'Failed to send request' });
  }
}, { protect: true });
