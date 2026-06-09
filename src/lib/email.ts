import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtppro.zoho.com
  port: Number(process.env.SMTP_PORT), // 465
  secure: true, // MUST be true for port 465 (Zoho SSL requirement)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
  // If SMTP variables aren't provided, just log for dev purposes
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`\n\n--- 📧 EMAIL MOCK (SMTP variables not set) ---`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (HTML):\n${html}`);
    console.log(`-------------------------------------------\n\n`);
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: `"HRM System" <${process.env.SMTP_USER}>`,
      to,
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
