import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/services/emailService';

export async function POST(req: Request, context: any) {
  try {
    // Safely await params for Next.js 14/15 compatibility
    const params = await Promise.resolve(context.params);
    const userId = params?.id;

    if (!userId || userId === 'undefined') {
      return NextResponse.json({ success: false, message: 'Invalid or missing User ID.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customDesignation: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if (!user.email) {
      return NextResponse.json({ success: false, message: 'User has no email address' }, { status: 400 });
    }

    const designationName = user.customDesignation?.name || user.designation || 'Employee';

    await sendWelcomeEmail(
      user.email,
      user.name,
      undefined,
      designationName,
      undefined,
      user.deviceId,
      user.employeeId || undefined
    );

    return NextResponse.json({ success: true, message: 'Welcome email resent successfully.' });
  } catch (error: any) {
    console.error('Error resending welcome email:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
