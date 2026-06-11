import nodemailer from 'nodemailer';

const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, // smtppro.zoho.com
    port: Number(process.env.SMTP_PORT), // 465
    secure: true, // MUST be true for port 465 (Zoho SSL requirement)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendMail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EmailService] SMTP credentials not configured. Skipping email to', to);
    throw new Error('SMTP credentials not configured');
  }
  try {
    const transporter = getTransporter();
    await transporter.verify(); // Check connection
    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || `"HRM Portal" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[EmailService] Email sent to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error('[EmailService] Failed to send email:', error);
    throw error;
  }
};

const sendEmail = async (to: string, subject: string, html: string) => {
  await sendMail({ to, subject, html });
};

export const sendWelcomeEmail = async (
  toEmail: string,
  name: string,
  password?: string,
  designation?: string,
  loginUrl?: string,
  deviceId?: number | null
) => {
  const url = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5001/login';
  const html = `
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">Welcome to the Team!</h1>
        <p style="color: #e0e7ff; margin-top: 8px; font-size: 15px;">Your account has been successfully created.</p>
      </div>
      <div style="padding: 30px;">
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">We're thrilled to have you onboard as our new <strong>${designation || 'Employee'}</strong>. Your secure HR portal account is ready. Below are your login credentials:</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;"><strong>Email:</strong> <span style="color: #0f172a;">${toEmail}</span></p>
          <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;"><strong>Password:</strong> <span style="color: #0f172a; font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password || '********'}</span></p>
          ${deviceId ? `<p style="margin: 0; color: #475569; font-size: 14px;"><strong>Attendance Device ID:</strong> <span style="color: #0f172a; font-weight: bold;">${deviceId}</span></p>` : ''}
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">Log In to Your Account</a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 30px;">
          For your security, we highly recommend changing your password after your first login.
        </p>
      </div>
      <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} HRM Portal. All rights reserved.</p>
        <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;
  await sendEmail(toEmail, 'Welcome! Your Login Credentials', html);
};

export const sendLeaveUpdateEmail = async (
  toEmail: string,
  name: string,
  leaveType: string,
  status: string,
  loginUrl?: string
) => {
  const url = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5001/dashboard/leaves';
  const isApproved = status.toLowerCase() === 'approved';
  const color = isApproved ? '#10b981' : '#ef4444'; // Emerald for Approved, Red for Rejected
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="background: ${color}; padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">Leave Request ${status}</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Your <strong>${leaveType}</strong> leave request has been officially <strong>${status}</strong>.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">View Details in Portal</a>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} HRM Portal. All rights reserved.</p>
        <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;
  await sendEmail(toEmail, `Leave Request ${status}`, html);
};

export const buildHRNotificationTemplate = (title: string, messageBody: string) => {
  return `
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="background: #475569; padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">HRM Portal</h1>
        <p style="color: #e2e8f0; margin-top: 8px; font-size: 15px;">${title}</p>
      </div>
      <div style="padding: 30px; background-color: #f8fafc;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6; white-space: pre-wrap; margin: 0;">${messageBody}</p>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} HRM Portal. All rights reserved.</p>
        <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">This is an automated HR notification, please do not reply.</p>
      </div>
    </div>
  `;
};
