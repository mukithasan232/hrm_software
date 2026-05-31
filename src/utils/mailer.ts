import nodemailer from 'nodemailer';

const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendWelcomeEmail = async (
  toEmail: string,
  name: string,
  password?: string,
  loginUrl?: string
) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Mailer] SMTP credentials not configured. Skipping welcome email.');
    return;
  }

  const transporter = getTransporter();
  const url = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5001/login';

  const html = `
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">Welcome to the Team!</h1>
        <p style="color: #e0e7ff; margin-top: 8px; font-size: 15px;">Your account has been successfully created.</p>
      </div>

      <!-- Body -->
      <div style="padding: 30px;">
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">We're thrilled to have you onboard. Your secure HR portal account is ready. Below are your login credentials:</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;"><strong>Email:</strong> <span style="color: #0f172a;">${toEmail}</span></p>
          <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Password:</strong> <span style="color: #0f172a; font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password || '********'}</span></p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">Log In to Your Account</a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 30px;">
          For your security, we highly recommend changing your password after your first login.
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} HRM Portal. All rights reserved.</p>
        <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"HRM Portal" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Welcome! Your Login Credentials',
      html,
    });
    console.log(`[Mailer] Welcome email sent to ${toEmail}`);
  } catch (error) {
    console.error('[Mailer] Failed to send welcome email:', error);
  }
};
