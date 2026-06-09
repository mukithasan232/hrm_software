import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true, // MUST be true for port 465 (Zoho SSL requirement)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, bcc, subject, html }: { to?: string; bcc?: string | string[]; subject: string; html: string }) => {
  // If SMTP variables aren't provided, log warning and gracefully bypass
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials missing. Bypassing email broadcast.");
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER, // EXACTLY matches authenticated user to avoid Zoho rejection
      to: to || process.env.SMTP_USER, // fallback to sender if only bcc is used
      bcc,
      subject,
      html,
    });
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
