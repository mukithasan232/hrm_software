import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';
import { saveLocalFile } from '@/lib/fileUploader';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const mockReq = await parseRequest(req);
    
    if (!mockReq.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: getCorsHeaders() });
    }

    const signatureUrl = mockReq.file?.signature?.path;
    
    if (!signatureUrl) {
      return NextResponse.json({ message: 'No signature file provided' }, { status: 400, headers: getCorsHeaders() });
    }

    // Update user in DB
    const updatedUser = await (prisma.user as any).update({
      where: { id: mockReq.user.id },
      data: { signatureUrl }
    });

    return NextResponse.json({ 
      message: 'Signature uploaded successfully',
      signatureUrl 
    }, { headers: getCorsHeaders() });
    
  } catch (error: any) {
    console.error('[Signature Upload Error]', error);
    return NextResponse.json({ message: error.message || 'Failed to upload signature' }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
