import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

// ── GET: Fetch current SMTP settings ──────────────────────────────────────────
const getEmailSettings = async (req: any, res: any) => {
  try {
    const settings = await prisma.smtpSettings.findFirst();
    return res.json(settings || {});
  } catch (error: any) {
    console.error('SMTP DB Fetch Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
};

// ── POST: Upsert SMTP settings ────────────────────────────────────────────────
const upsertEmailSettings = async (req: any, res: any) => {
  try {
    const body = req.body;
    const { host, port, security, username, password } = body;

    if (!host || !port || !username || !password) {
      return res.status(400).json({ error: 'All fields are required (host, port, username, password).' });
    }

    const portNum = parseInt(String(port), 10);
    if (isNaN(portNum)) {
      return res.status(400).json({ error: 'Port must be a valid number.' });
    }

    // Check if a record already exists — if so, update it
    const existing = await prisma.smtpSettings.findFirst();

    let settings;
    if (existing) {
      settings = await prisma.smtpSettings.update({
        where: { id: existing.id },
        data: {
          host:     host.trim(),
          port:     portNum,
          security: security || 'STARTTLS',
          username: username.trim(),
          password,
        },
      });
    } else {
      // SmtpSettings requires a TenantSettings FK (tenantId).
      // Fetch or auto-create the singleton TenantSettings row.
      let tenant = await prisma.tenantSettings.findFirst();
      if (!tenant) {
        tenant = await prisma.tenantSettings.create({
          data: { companyName: 'Default Tenant' },
        });
      }

      settings = await prisma.smtpSettings.create({
        data: {
          host:     host.trim(),
          port:     portNum,
          security: security || 'STARTTLS',
          username: username.trim(),
          password,
          tenantId: tenant.id,
        },
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
