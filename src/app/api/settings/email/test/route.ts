import nodemailer from 'nodemailer';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const testSmtpConnection = async (req: any, res: any) => {
  try {
    const { host, port, security, username, password } = req.body;

    if (!host || !port || !username || !password) {
      return res.status(400).json({ error: 'Missing required SMTP fields (host, port, username, password).' });
    }

    const secure = security === 'SSL/TLS';

    const transporter = nodemailer.createTransport({
      host,
      port:   parseInt(String(port), 10),
      secure, // true for 465 (SSL/TLS), false for 587 (STARTTLS)
      auth: {
        user: username,
        pass: password,
      },
    });

    await transporter.verify();

    return res.json({ message: 'SMTP connection verified successfully!' });
  } catch (error: any) {
    console.error('SMTP Test Error:', error);
    return res.status(500).json({ error: error.message || 'SMTP connection failed' });
  }
};

export const POST = wrapHandler(testSmtpConnection, {
  protect:              true,
  adminOnly:            true,
});
