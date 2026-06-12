import nodemailer from 'nodemailer';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const testSmtpConnection = async (req: any, res: any) => {
  const { host, port, security, username, password } = req.body;

  if (!host || !port || !username || !password) {
    return res.status(400).json({ error: 'Missing required SMTP fields (host, port, username, password).' });
  }

  const secure = security === 'SSL/TLS';

  try {
    const transporter = nodemailer.createTransport({
      host,
      port:              parseInt(String(port), 10),
      secure,            // true = SSL/TLS (465), false = STARTTLS (587)
      auth:              { user: username, pass: password },
      connectionTimeout: 10000, // 10s — surface timeout errors clearly
      greetingTimeout:   10000,
      socketTimeout:     15000,
    });

    await transporter.verify();

    return res.json({ message: `SMTP connection verified successfully via ${host}:${port}!` });
  } catch (error: any) {
    // Log the full error server-side for debugging
    console.error('SMTP Test Error:', error);

    // Craft a human-readable error message from the exact Nodemailer error
    const raw: string = error.message || error.toString() || 'Unknown SMTP error';
    let friendly = raw;

    if (/ECONNREFUSED/i.test(raw))    friendly = `Connection refused — check host/port. (${host}:${port})`;
    else if (/ENOTFOUND/i.test(raw))  friendly = `Host not found — invalid SMTP server address: "${host}"`;
    else if (/ETIMEDOUT/i.test(raw))  friendly = `Connection timed out — server did not respond. (${host}:${port})`;
    else if (/auth/i.test(raw))       friendly = `Authentication failed — check username/password. Detail: ${raw}`;
    else if (/certificate/i.test(raw)) friendly = `TLS/SSL certificate error — try a different security mode. Detail: ${raw}`;
    else if (/STARTTLS/i.test(raw))   friendly = `STARTTLS negotiation failed — try SSL/TLS mode. Detail: ${raw}`;

    return res.status(500).json({
      error:   friendly,
      raw:     raw,  // always include exact Nodemailer message for devs
    });
  }
};

export const POST = wrapHandler(testSmtpConnection, {
  protect:   true,
  adminOnly: true,
});
