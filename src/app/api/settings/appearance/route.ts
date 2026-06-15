export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import jwt from 'jsonwebtoken';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveToken(req: NextRequest): { id: string; designation: string } | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'fallback_secret') as any;
  } catch {
    return null;
  }
}

// ── GET /api/settings/appearance ─────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  id:             'default',
  companyName:    'HRM Portal',
  logoUrl:        null as string | null,
  faviconUrl:     null as string | null,
  primaryColor:   '#8b5cf6',
  secondaryColor: '#06b6d4',
  updatedAt:      new Date(),
};

export async function GET() {
  try {
    // Try to find the existing row
    let settings = await prisma.tenantSettings.findFirst();

    // Table is empty — seed the default row so future reads are fast
    if (!settings) {
      try {
        settings = await prisma.tenantSettings.create({
          data: {
            companyName:    DEFAULT_SETTINGS.companyName,
            primaryColor:   DEFAULT_SETTINGS.primaryColor,
            secondaryColor: DEFAULT_SETTINGS.secondaryColor,
            logoUrl:        DEFAULT_SETTINGS.logoUrl,
            faviconUrl:     DEFAULT_SETTINGS.faviconUrl,
          },
        });
      } catch (createErr) {
        // Race condition or DB issue — return in-memory defaults, never 500
        console.warn('[AppearanceGET] Could not seed defaults:', createErr);
        return NextResponse.json(DEFAULT_SETTINGS);
      }
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    // Any DB connection issue — return safe defaults so the UI still loads
    console.error('[AppearanceGET] DB error, returning defaults:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// ── PUT /api/settings/appearance ─────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const user = resolveToken(req);
  if (!user) return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  const ADMIN_ROLES = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
  const userRole = (user.designation || '').toLowerCase().trim();

  if (!ADMIN_ROLES.includes(userRole)) {
    console.error(`[AppearancePUT] Admin access denied. Received designation: "${user.designation}"`);
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    let companyName: string | undefined;
    let primaryColor: string | undefined;
    let secondaryColor: string | undefined;
    let logoUrl: string | undefined;
    let faviconUrl: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch (parseErr: any) {
        console.error('[AppearancePUT] FormData parsing failed:', parseErr);
        return NextResponse.json({ message: 'Invalid form data payload. Ensure boundaries are correct.' }, { status: 400 });
      }
      
      companyName    = (formData.get('companyName') as string) ?? undefined;
      primaryColor   = (formData.get('primaryColor') as string) ?? undefined;
      secondaryColor = (formData.get('secondaryColor') as string) ?? undefined;

      const logoFile    = formData.get('logo') as File | null;
      const faviconFile = formData.get('favicon') as File | null;

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      if (logoFile && logoFile.size > 0) {
        try {
          const buffer = Buffer.from(await logoFile.arrayBuffer());
          const safeName = logoFile.name.replace(/[^a-zA-Z0-9.-]/g, '-');
          const filename = `logo-${Date.now()}-${safeName}`;
          fs.writeFileSync(path.join(uploadDir, filename), buffer);
          logoUrl = `/uploads/${filename}`;
        } catch (uploadErr) {
          console.error('[Upload Error]: ', uploadErr);
        }
      }

      if (faviconFile && faviconFile.size > 0) {
        try {
          const buffer = Buffer.from(await faviconFile.arrayBuffer());
          const safeName = faviconFile.name.replace(/[^a-zA-Z0-9.-]/g, '-');
          const filename = `favicon-${Date.now()}-${safeName}`;
          fs.writeFileSync(path.join(uploadDir, filename), buffer);
          faviconUrl = `/uploads/${filename}`;
        } catch (uploadErr) {
          console.error('[Upload Error]: ', uploadErr);
        }
      }
    } else {
      const body     = await req.json();
      companyName    = body.companyName;
      primaryColor   = body.primaryColor;
      secondaryColor = body.secondaryColor;
      logoUrl        = body.logoUrl;
      faviconUrl     = body.faviconUrl;
    }

    // Build partial update (only provided fields)
    const data: Record<string, any> = {};
    if (companyName    !== undefined) data.companyName    = companyName.trim() || 'HRM Portal';
    if (primaryColor   !== undefined) data.primaryColor   = primaryColor.trim() || '#8b5cf6';
    if (secondaryColor !== undefined) data.secondaryColor = secondaryColor.trim() || '#06b6d4';
    if (logoUrl        !== undefined) data.logoUrl        = logoUrl || null;
    if (faviconUrl     !== undefined) data.faviconUrl     = faviconUrl || null;

    const existing = await prisma.tenantSettings.findFirst();
    const result = existing
      ? await prisma.tenantSettings.update({ where: { id: existing.id }, data })
      : await prisma.tenantSettings.create({
          data: {
            companyName:    data.companyName    ?? 'HRM Portal',
            primaryColor:   data.primaryColor   ?? '#8b5cf6',
            secondaryColor: data.secondaryColor ?? '#06b6d4',
            logoUrl:        data.logoUrl        ?? null,
            faviconUrl:     data.faviconUrl     ?? null,
          },
        });

    // CACHE BUSTING: force Next.js to drop all server-rendered cache so the layout instantly picks up the new brand
    revalidatePath('/', 'layout');
    
    return NextResponse.json({ message: 'Appearance settings saved', settings: result });
  } catch (error: any) {
    console.error('[AppearancePUT]', error);
    return NextResponse.json({ message: 'Failed to save appearance settings', error: error.message }, { status: 500 });
  }
}
