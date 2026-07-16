import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

/**
 * INBOX SCOPE LOGIC (Backend Scaffold)
 * ------------------------------------
 * When fetching emails/inbox records, the API MUST apply Prisma conditions based on the user's Designation Inbox permission:
 *
 * 1. OWN scope:
 *    where: { recipientEmail: user.email }
 *
 * 2. DEPARTMENT scope:
 *    where: { user: { department: user.department } }
 *
 * 3. ALL scope:
 *    Fetch all records without restrictions.
 */

const getTransporter = async () => {
  try {
    const dbSettings = await prisma.smtpSettings.findFirst();
    if (dbSettings && dbSettings.host && dbSettings.username && dbSettings.password) {
      return {
        transporter: nodemailer.createTransport({
          host: dbSettings.host,
          port: dbSettings.port,
          secure: dbSettings.security === 'SSL/TLS',
          auth: {
            user: dbSettings.username,
            pass: dbSettings.password,
          },
        }),
        fromUser: dbSettings.username,
      };
    }
  } catch (error) {
    console.error('[EmailService] Failed to fetch dynamic SMTP settings. Falling back to ENV:', error);
  }

  // Fallback
  return {
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }),
    fromUser: process.env.SMTP_USER,
  };
};

export const sendMail = async ({ to, subject, html, attachments }: { to: string; subject: string; html: string; attachments?: any[] }) => {
  try {
    const { transporter, fromUser } = await getTransporter();
    
    if (!fromUser) {
      console.warn('[EmailService] SMTP credentials not configured (DB or ENV). Skipping email to', to);
      throw new Error('SMTP credentials not configured');
    }

    await transporter.verify(); // Check connection
    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || `"HRM Portal" <${fromUser}>`,
      to,
      subject,
      html,
      attachments,
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

export const compileTemplate = (templateString: string, variables: Record<string, any>) => {
  return templateString.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : match;
  });
};

export const sendWelcomeEmail = async (
  toEmail: string,
  name: string,
  password?: string,
  designation?: string,
  loginUrl?: string,
  deviceId?: number | null,
  employeeId?: string
) => {
  const url = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://hrm.fixanyphoto.com/login';
  
  let subject = 'Welcome! Your Login Credentials';
  let html = '';

  const variables = {
    name,
    email: toEmail,
    password: password || '********',
    designation: designation || 'Employee',
    url,
    deviceId: deviceId ? deviceId.toString() : 'Not Assigned',
    employeeId: employeeId || 'Not Assigned',
    currentYear: new Date().getFullYear().toString()
  };

  try {
    const template = await (prisma as any).emailTemplate.findUnique({ where: { type: 'WELCOME_EMAIL' } });
    if (template) {
      subject = compileTemplate(template.subject, variables);
      html = compileTemplate(template.body, variables);
    }
  } catch (err) {
    console.error('[EmailService] Failed to fetch WELCOME_EMAIL template', err);
  }

  if (!html) {
    html = `
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
            ${employeeId ? `<p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;"><strong>Employee ID:</strong> <span style="color: #0f172a; font-weight: bold;">${employeeId}</span></p>` : ''}
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
  }
  await sendEmail(toEmail, subject, html);
};

export const sendLeaveUpdateEmail = async (
  toEmail: string,
  name: string,
  leaveType: string,
  status: string,
  loginUrl?: string
) => {
  const url = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://hrm.fixanyphoto.com/dashboard/leaves';
  const isApproved = status.toLowerCase() === 'approved';
  const color = isApproved ? '#10b981' : '#ef4444'; 
  
  let subject = `Leave Request ${status}`;
  let html = '';

  const variables = {
    name,
    leaveType,
    status,
    url,
    color,
    currentYear: new Date().getFullYear().toString()
  };

  try {
    const template = await (prisma as any).emailTemplate.findUnique({ where: { type: 'LEAVE_UPDATE' } });
    if (template) {
      subject = compileTemplate(template.subject, variables);
      html = compileTemplate(template.body, variables);
    }
  } catch (err) {
    console.error('[EmailService] Failed to fetch LEAVE_UPDATE template', err);
  }

  if (!html) {
    html = `
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
  }
  await sendEmail(toEmail, subject, html);
};

export const sendNewLeaveRequestEmail = async (
  toEmail: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string,
  loginUrl?: string
) => {
  const url = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://hrm.fixanyphoto.com/dashboard/leaves';
  const subject = `New Leave Request from ${employeeName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="background: #3b82f6; padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">New Leave Request</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hello Admin,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;"><strong>${employeeName}</strong> has submitted a new leave request.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 5px 0;"><strong>Type:</strong> ${leaveType}</p>
          <p style="margin: 5px 0;"><strong>Dates:</strong> ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason || 'N/A'}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">Review in Portal</a>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} HRM Portal. All rights reserved.</p>
      </div>
    </div>
  `;
  await sendEmail(toEmail, subject, html);
};

export const buildHRNotificationTemplate = async (title: string, messageBody: string) => {
  let html = '';
  
  const variables = {
    title,
    messageBody,
    currentYear: new Date().getFullYear().toString()
  };

  try {
    const template = await (prisma as any).emailTemplate.findUnique({ where: { type: 'HR_NOTIFICATION' } });
    if (template) {
      html = compileTemplate(template.body, variables);
    }
  } catch (err) {
    console.error('[EmailService] Failed to fetch HR_NOTIFICATION template', err);
  }

  if (!html) {
    html = `
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
  }
  return html;
};
