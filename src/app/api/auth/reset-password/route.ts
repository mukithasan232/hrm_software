import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

// POST /api/auth/reset-password
// Handles requesting a reset link AND resetting the password via token
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, token, newPassword } = body;

    // Action 1: Request Reset Link
    if (action === 'request') {
      if (!email) return NextResponse.json({ message: 'Email is required' }, { status: 400 });

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // We still return 200 to prevent email enumeration
        return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
      }

      // Generate token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { email },
        data: { resetToken, resetTokenExpiry }
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>We received a request to reset your password.</p>
          <p>Click the button below to reset it. This link is valid for 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; margin: 20px 0; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `;

      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: emailHtml
      });

      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Action 2: Perform Reset
    if (action === 'reset') {
      if (!token || !newPassword) {
        return NextResponse.json({ message: 'Token and new password are required' }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() } // Token must not be expired
        }
      });

      if (!user) {
        return NextResponse.json({ message: 'Invalid or expired token' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null
        }
      });

      return NextResponse.json({ message: 'Password has been successfully reset' });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}
