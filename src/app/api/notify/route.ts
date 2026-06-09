import { NextRequest, NextResponse } from 'next/server';
import { sendMail, buildHRNotificationTemplate } from '@/services/emailService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, message } = body;

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, or message' },
        { status: 400 }
      );
    }

    const html = buildHRNotificationTemplate(subject, message);

    await sendMail({
      to,
      subject,
      html,
    });

    return NextResponse.json(
      { message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API/Notify] Failed to send email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email notification', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
