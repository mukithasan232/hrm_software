import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const testSmtpConnection = async (req: Request) => {
  try {
    const body = await req.json();
    const { host, port, security, username, password } = body;

    if (!host || !port || !username || !password) {
      return NextResponse.json({ error: 'Missing required SMTP fields' }, { status: 400 });
    }

    const secure = security === 'SSL/TLS';

    // Create a Nodemailer transporter using SMTP
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure, // true for 465, false for other ports
      auth: {
        user: username,
        pass: password,
      },
    });

    // verify connection configuration
    await transporter.verify();

    return NextResponse.json({ message: 'SMTP connection verified successfully!' }, { status: 200 });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    return NextResponse.json({ error: error.message || 'SMTP connection failed' }, { status: 500 });
  }
};

export const POST = wrapHandler(testSmtpConnection, {
  protect: true,
  allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'],
});
