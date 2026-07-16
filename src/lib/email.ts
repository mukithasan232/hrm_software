import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("Nodemailer Global Auth Error:", error);
  } else {
    console.log("Global Mailer Utility is ready to send messages.");
  }
});

export const sendEmail = async ({ to, bcc, subject, html }: { to?: string; bcc?: string | string[]; subject: string; html: string }) => {
  // If SMTP variables aren't provided, log warning and gracefully bypass
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
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
