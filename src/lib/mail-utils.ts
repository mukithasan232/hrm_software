import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function sendEventEmail(
  adminId: string, 
  eventType: 'emailOnLeave' | 'emailOnTask' | 'emailOnLate' | 'emailOnSystemAlert', 
  emailData: { subject: string; html: string }
) {
  try {
    const admin = await prisma.user.findUnique({ 
      where: { id: adminId }, 
      select: { notificationPrefs: true, email: true } 
    });

    if (!admin || !admin.email) return false;

    let prefs: any = admin.notificationPrefs;
    if (typeof prefs === 'string') {
      try {
        prefs = JSON.parse(prefs);
      } catch (e) {
        prefs = {};
      }
    }

    // Fallback to schema defaults if not explicitly set
    const defaultPrefs = {
      emailOnLeave: true,
      emailOnTask: true,
      emailOnLate: false,
      emailOnSystemAlert: true
    };

    const finalPrefs = { ...defaultPrefs, ...(prefs || {}) };

    if (finalPrefs[eventType] === true) {
      await sendEmail({ 
        to: admin.email, 
        subject: emailData.subject, 
        html: emailData.html 
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error in sendEventEmail:', error);
    return false;
  }
}
