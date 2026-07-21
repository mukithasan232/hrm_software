/**
 * email.ts — thin wrapper around emailService.ts
 *
 * Credential resolution order:
 *   1. smtpSettings row in the database (set via HRM Settings page)
 *   2. SMTP_USER / SMTP_PASSWORD / SMTP_HOST / SMTP_PORT env vars (fallback only)
 *
 * The static transporter that used only env vars has been removed so that
 * a placeholder SMTP_PASS in the Docker/Swarm environment can never shadow
 * the valid credentials saved in the database.
 */

import { sendMail } from '@/services/emailService';

export const sendEmail = async ({
  to,
  bcc,
  subject,
  html,
}: {
  to?: string;
  bcc?: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> => {
  try {
    // sendMail in emailService reads DB settings first, falls back to env.
    await sendMail({ to, bcc, subject, html });
    return true;
  } catch (error) {
    console.error('[email.ts] sendEmail failed:', error);
    throw error;
  }
};
