import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getCorsHeaders } from '@/lib/adapter';

export const dynamic = 'force-dynamic';

const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return { id: decoded.id, designation: (decoded.designation || '').toLowerCase().trim() };
  } catch {
    return null;
  }
}

// GET all templates
export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || !ADMIN_DESIGNATIONS.includes(user.designation)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
  }

  try {
    // Race the DB query against a 5-second timeout
    const templates = await Promise.race([
      (prisma as any).emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } }) as Promise<any[]>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB query timed out after 5s')), 5000)
      ),
    ]);

    return NextResponse.json(templates, { status: 200, headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[API/EmailTemplates] GET Error:', error.message);
    // On timeout or error, return empty array so UI doesn't hang
    return NextResponse.json([], { status: 200, headers: getCorsHeaders() });
  }
}

// POST to upsert a template
export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || !ADMIN_DESIGNATIONS.includes(user.designation)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
  }

  try {
    const { type, subject, body } = await req.json();

    if (!type || !subject || !body) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400, headers: getCorsHeaders() });
    }

    const template = await Promise.race([
      (prisma as any).emailTemplate.upsert({
        where: { type },
        update: { subject, body },
        create: { type, subject, body },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB query timed out after 5s')), 5000)
      ),
    ]);

    return NextResponse.json({ message: 'Template saved successfully', template }, { status: 200, headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[API/EmailTemplates] POST Error:', error.message);
    return NextResponse.json({ message: error.message || 'Failed to save template' }, { status: 500, headers: getCorsHeaders() });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
