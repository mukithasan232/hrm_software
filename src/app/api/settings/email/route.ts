import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

// ── GET: Fetch current email/SMTP settings ────────────────────────────────────
const getEmailSettings = async (req: any, res: any) => {
  try {
    const settings = await prisma.smtpSettings.findFirst();
    return res.json(settings || {});
  } catch (error: any) {
    console.error('SMTP DB Fetch Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
};

// ── POST: Upsert email/SMTP settings ─────────────────────────────────────────
const upsertEmailSettings = async (req: any, res: any) => {
  try {
    const body = req.body;
    const {
      // SMTP fields
      host, port, security, username, password,
      // MAIN tab fields
      senderName, senderEmail, emailEnabled,
    } = body;

    // At least SMTP fields are required if host is provided
    if (host !== undefined) {
      if (!host || !port || !username || !password) {
        return res.status(400).json({ error: 'SMTP requires host, port, username and password.' });
      }
      const portNum = parseInt(String(port), 10);
      if (isNaN(portNum)) {
        return res.status(400).json({ error: 'Port must be a valid number.' });
      }
    }

    const portNum = host ? parseInt(String(port), 10) : undefined;

    // Build shared data object — only include defined fields
    const smtpData: Record<string, any> = {};
    if (host       !== undefined) smtpData.host         = host.trim();
    if (portNum    !== undefined) smtpData.port         = portNum;
    if (security   !== undefined) smtpData.security     = security || 'STARTTLS';
    if (username   !== undefined) smtpData.username     = username.trim();
    if (password   !== undefined) smtpData.password     = password;
    if (senderName !== undefined) smtpData.senderName   = senderName.trim();
    if (senderEmail !== undefined) smtpData.senderEmail = senderEmail.trim();
    if (emailEnabled !== undefined) smtpData.emailEnabled = Boolean(emailEnabled);

    const existing = await prisma.smtpSettings.findFirst();

    let settings;
    if (existing) {
      settings = await prisma.smtpSettings.update({
        where: { id: existing.id },
        data:  smtpData,
      });
    } else {
      // Require SMTP fields for first-time creation
      if (!host || !port || !username || !password) {
        return res.status(400).json({ error: 'All SMTP fields are required for initial setup.' });
      }
      // Auto-create singleton TenantSettings if needed
      let tenant = await prisma.tenantSettings.findFirst();
      if (!tenant) {
        tenant = await prisma.tenantSettings.create({
          data: { companyName: 'Default Tenant' },
        });
      }
      settings = await prisma.smtpSettings.create({
        data: { ...smtpData, tenantId: tenant.id } as any,
      });
    }

    return res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('SMTP DB Save Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save settings' });
  }
};

export const GET  = wrapHandler(getEmailSettings,    { protect: true, adminOnly: true });
export const POST = wrapHandler(upsertEmailSettings, { protect: true, adminOnly: true });
