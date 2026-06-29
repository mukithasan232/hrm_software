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
      return NextResponse.json({ message: 'If that email exists, a new password has been sent.' });
    }

    // Generate a new random password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + "1!";

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Your New Password</h2>
        <p>We received a request to reset your password.</p>
        <p>Your new password is: <strong>${newPassword}</strong></p>
        <p>Please log in with this new password and change it as soon as possible from your profile settings.</p>
        <p>If you did not request this, please contact your administrator immediately.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Your New Password',
      html: emailHtml
    });

    return NextResponse.json({ message: 'If that email exists, a new password has been sent.' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}
