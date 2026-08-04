import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';

export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const { title, message, targetType, targetDepartment, targetUserId } = req.body;
    const authorId = (req as any).user.id;

    if (!title || !message || !targetType) {
      return res.status(400).json({ message: 'Title, message, and targetType are required' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message,
        targetType,
        targetDepartment: targetType === 'DEPARTMENT' ? targetDepartment : null,
        targetUserId: targetType === 'INDIVIDUAL' ? targetUserId : null,
        authorId
      }
    });

    // Fetch targets for email
    let users: { email: string }[] = [];
    if (targetType === 'GLOBAL') {
      users = await prisma.user.findMany({ where: { isActive: true }, select: { email: true } });
    } else if (targetType === 'DEPARTMENT' && targetDepartment) {
      users = await prisma.user.findMany({ where: { department: targetDepartment, isActive: true }, select: { email: true } });
    } else if (targetType === 'INDIVIDUAL' && targetUserId) {
      users = await prisma.user.findMany({ where: { id: targetUserId, isActive: true }, select: { email: true } });
    }

    const bccEmails = users.map(u => u.email).filter(Boolean);

    if (bccEmails.length > 0) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #4F46E5;">Notice: ${title}</h2>
          <p style="white-space: pre-wrap; font-size: 15px;">${message}</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">This is an automated broadcast from your HRM system. Please do not reply directly to this email.</p>
        </div>
      `;

      // Use BCC for bulk email privacy
      try {
        await sendEmail({
          bcc: bccEmails,
          subject: `[Company Notice]: ${title}`,
          html: emailHtml
        });
      } catch (emailError) {
        console.error('[SMTP Error]:', emailError);
        // Do NOT throw. Let the API return 200 OK since the DB record was saved.
      }
    }

    res.status(200).json({ message: 'Announcement sent successfully', announcement });
  } catch (error: any) {
    console.error('[Announcement API Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getAnnouncements = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // Use our new dynamic utility
    const { getPermissionScopeSync } = await import('../utils/checkPermission');
    let scope = getPermissionScopeSync(user, 'Announcements', 'read');

    // Default to 'own' so standard users can see global and department announcements
    // even if their permission matrix doesn't explicitly mention 'Announcements'.
    if (scope === 'no') {
       scope = 'own';
    }

    // Ensure we have fresh user data for department checking if it might have changed
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { department: true }
    });

    let where: any = {};
    if (scope === 'all') {
      // Can view all announcements
      where = {};
    } else {
      where = {
        OR: [
          { targetType: 'GLOBAL' },
          { targetType: 'DEPARTMENT', targetDepartment: dbUser?.department || '' },
          { targetType: 'INDIVIDUAL', targetUserId: user.id }
        ]
      };
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.status(200).json(announcements);
  } catch (error: any) {
    console.error('[ANNOUNCEMENTS_API_ERROR]', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = (req as any).params;
    await prisma.announcement.delete({ where: { id } });
    res.status(200).json({ message: 'Announcement deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete announcement', error: error.message });
  }
};

export const clearAnnouncements = async (req: Request, res: Response) => {
  try {
    // Delete all announcements
    await prisma.announcement.deleteMany({});
    res.status(200).json({ message: 'Notice board cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to clear notice board', error: error.message });
  }
};
