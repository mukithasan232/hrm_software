export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// ── Auth helper (reused pattern from appearance/route.ts) ─────────────────────

function resolveToken(req: NextRequest): { id: string; designation: string } | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(
      auth.split(' ')[1],
      process.env.JWT_SECRET || 'fallback_secret'
    ) as any;
  } catch {
    return null;
  }
}

// ── GET /api/settings/ai ──────────────────────────────────────────────────────
// Returns provider name + whether a key is saved. NEVER returns the raw key.

export async function GET() {
  try {
    const settings = await prisma.tenantSettings.findFirst({
      select: { aiProvider: true, aiApiKey: true },
    });

    let maskedApiKey: string | null = null;
    if (settings?.aiApiKey) {
      const key = settings.aiApiKey;
      maskedApiKey = key.length > 4 
        ? '••••••••••••' + key.substring(key.length - 4)
        : '••••••••••••';
    }

    return NextResponse.json({
      aiProvider: settings?.aiProvider ?? 'google',
      hasApiKey: !!settings?.aiApiKey,
      maskedApiKey,
    });
  } catch (error: any) {
    console.error('[AI-Settings GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI settings', details: error.message },
      { status: 500 }
    );
  }
}

// ── POST /api/settings/ai ──────────────────────────────────────────────────────
// Saves aiProvider + aiApiKey to TenantSettings. Admin only.

export async function POST(req: NextRequest) {
  const user = resolveToken(req);
  if (!user) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  // Basic admin role check (same pattern as appearance route)
  const ADMIN_ROLES = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
  const desigName =
    typeof user.designation === 'object'
      ? (user.designation as any)?.name
      : user.designation;
  const userRole = (desigName || '').toLowerCase().trim();
  let isAdmin = ADMIN_ROLES.includes(userRole);

  if (!isAdmin) {
    // Fallback: check DB user type
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.userType === 'SUPER_ADMIN' || dbUser?.email === 'dev@fixanyphoto.com') {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { aiProvider, aiApiKey } = await req.json() as {
      aiProvider?: string;
      aiApiKey?: string;
    };

    const data: Record<string, any> = {};
    if (aiProvider) data.aiProvider = aiProvider;
    if (aiApiKey !== undefined) data.aiApiKey = aiApiKey || null;

    const existing = await prisma.tenantSettings.findFirst();

    const result = existing
      ? await prisma.tenantSettings.update({ where: { id: existing.id }, data })
      : await prisma.tenantSettings.create({
          data: {
            companyName: 'HRM Portal',
            primaryColor: '#8b5cf6',
            secondaryColor: '#06b6d4',
            aiProvider: data.aiProvider ?? 'google',
            aiApiKey: data.aiApiKey ?? null,
          },
        });

    return NextResponse.json({
      message: 'AI settings saved successfully',
      aiProvider: result.aiProvider,
      hasApiKey: !!result.aiApiKey,
    });
  } catch (error: any) {
    console.error('[AI-Settings PUT]', error);
    return NextResponse.json(
      { message: 'Failed to save AI settings', error: error.message },
      { status: 500 }
    );
  }
}

// ── DELETE /api/settings/ai ───────────────────────────────────────────────────
// Removes the aiApiKey from TenantSettings. Admin only.

export async function DELETE(req: NextRequest) {
  const user = resolveToken(req);
  if (!user) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  const ADMIN_ROLES = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
  const desigName = typeof user.designation === 'object' ? (user.designation as any)?.name : user.designation;
  const userRole = (desigName || '').toLowerCase().trim();
  let isAdmin = ADMIN_ROLES.includes(userRole);

  if (!isAdmin) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.userType === 'SUPER_ADMIN' || dbUser?.email === 'dev@fixanyphoto.com') {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const existing = await prisma.tenantSettings.findFirst();
    if (existing) {
      await prisma.tenantSettings.update({
        where: { id: existing.id },
        data: { aiApiKey: null },
      });
    }

    return NextResponse.json({ message: 'API Key removed successfully' });
  } catch (error: any) {
    console.error('[AI-Settings DELETE]', error);
    return NextResponse.json(
      { message: 'Failed to remove API key', error: error.message },
      { status: 500 }
    );
  }
}

