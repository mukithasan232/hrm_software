import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getEmailSettings = async (req: Request) => {
  const settings = await prisma.smtpSettings.findFirst();
  return NextResponse.json(settings || {});
};

const upsertEmailSettings = async (req: Request) => {
  const body = await req.json();
  const { host, port, security, username, password } = body;

  if (!host || !port || !username || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  const existing = await prisma.smtpSettings.findFirst();

  let settings;
  if (existing) {
    settings = await prisma.smtpSettings.update({
      where: { id: existing.id },
      data: {
        host,
        port: parseInt(port, 10),
        security,
        username,
        password,
      }
    });
  } else {
    // If TenantSettings exists, link it, otherwise create standalone (or create TenantSettings if required)
    // The schema says tenantId is required, so we need a tenant.
    let tenant = await prisma.tenantSettings.findFirst();
    if (!tenant) {
      tenant = await prisma.tenantSettings.create({
        data: {
          companyName: 'Default Tenant',
        }
      });
    }

    settings = await prisma.smtpSettings.create({
      data: {
        host,
        port: parseInt(port, 10),
        security,
        username,
        password,
        tenantId: tenant.id
      }
    });
  }

  return NextResponse.json({ success: true, data: settings });
};

export const GET = wrapHandler(getEmailSettings, { protect: true, adminOnly: true });
export const POST = wrapHandler(upsertEmailSettings, { protect: true, adminOnly: true });
