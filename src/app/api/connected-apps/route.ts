import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // @ts-ignore - Bypass IDE type caching for newly added model
    const apps = await (prisma as any).connectedApp.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(apps, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('[ConnectedApps GET]', error);
    return NextResponse.json({ error: 'Failed to fetch connected apps' }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  try {
    const mockReq = await parseRequest(req);
    
    if (!mockReq.user) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 401, headers: getCorsHeaders() });
    }

    const userRole = typeof mockReq.user.designation === 'object' 
      ? (mockReq.user.designation as any)?.name 
      : mockReq.user.designation;
      
    const isAdmin = ['Admin', 'Super Admin', 'System Administrator', 'SUPER_ADMIN'].includes(userRole);
    
    if (!isAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: getCorsHeaders() });
    }

    const { name, url, iconUrl } = mockReq.body;

    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400, headers: getCorsHeaders() });
    }

    // @ts-ignore - Bypass IDE type caching for newly added model
    const app = await (prisma as any).connectedApp.create({
      data: {
        name,
        url,
        iconUrl
      }
    });

    return NextResponse.json(app, { status: 201, headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[ConnectedApps POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add app to database. Check server logs.' }, 
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
