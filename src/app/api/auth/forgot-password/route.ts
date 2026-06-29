export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // We still return 200 to prevent email enumeration
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate token
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Clean up old tokens for this email and create a new one
    await prisma.passwordResetToken.deleteMany({
      where: { email }
    });

    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires
      }
    });

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const resetLink = `${origin}/reset-password?token=${token}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Password Reset Request</h2>
        <p>We received a request to reset your password.</p>
        <p>Click the link below to reset it:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    console.log('Reset Link generated:', resetLink); // Useful for development if SMTP fails

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      // If no SMTP settings, just succeed so the dev can use the console link
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    try {
      await sendEmail({
        to: email,
        subject: 'Password Reset',
        html: emailHtml
      });
    } catch (emailError: any) {
      console.error('Failed to send email:', emailError);
      return NextResponse.json({ message: 'Failed to send email. Please check SMTP settings.', error: emailError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}
