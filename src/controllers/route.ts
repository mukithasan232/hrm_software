import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { wrapHandler } from '@/lib/adapter';

export const POST = wrapHandler(async (req: any, { params }: { params: { id: string } }) => {
    try {
        const { id } = params;

        const user = await prisma.user.findUnique({
            where: { id },
            include: { customDesignation: true }
        });

        if (!user || !user.email) {
            return NextResponse.json({ message: 'User not found or has no email.' }, { status: 404 });
        }

        const { name, email, employeeId } = user;

        const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: #4f46e5; padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to the Team! (Reminder)</h1>
              <p style="color: #e0e7ff; margin-top: 8px;">Your employee account is ready.</p>
            </div>
            <div style="padding: 30px;">
              <p>Hi <strong>${name}</strong>,</p>
              <p>This is a reminder that your secure HR portal account has been created. You can log in using your credentials.</p>
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Enrollment ID:</strong> ${employeeId}</p>
                <p style="margin: 0 0 10px 0;"><strong>Login Email:</strong> ${email}</p>
              </div>
              <p>If you have forgotten your password, you can use the "Forgot Password" link on the login page.</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${loginUrl}/login" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold;">Log In Now</a>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
            to: email,
            subject: "Welcome to the Team - Your Account is Ready",
            html: emailHtml
        });

        return NextResponse.json({ success: true, message: 'Welcome email resent successfully.' });
    } catch (error: any) {
        console.error('[Resend Welcome Email Error]:', error);
        const errorMessage = error.message.includes('SMTP') ? 'Failed to send email due to SMTP error.' : 'An internal server error occurred.';
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
    }
}, { adminOnly: true, protect: true });