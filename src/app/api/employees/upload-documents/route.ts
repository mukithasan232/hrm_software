export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveLocalFile } from '@/lib/fileUploader';
import jwt from 'jsonwebtoken';
import { eventEmitter } from '@/lib/eventEmitter';
import { getCorsHeaders } from '@/lib/adapter';

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

// ── Helper: verify JWT and return userId ──────────────────────────────────────
function extractUserId(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback_secret') as any;
    return decoded.id;
  } catch {
    return null;
  }
}

// ── POST: Upload new documents ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders();

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const employee = await prisma.user.findUnique({ where: { id: userId } });
    if (!employee) {
      return NextResponse.json({ message: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error('[Upload Documents] Failed to parse form data:', e);
      return NextResponse.json({ message: 'Invalid form data' }, { status: 400, headers: corsHeaders });
    }

    const files = formData.getAll('documents');
    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'No documents provided' }, { status: 400, headers: corsHeaders });
    }

    const uploadedUrls: string[] = [];
    for (const file of files) {
      if (file && typeof file !== 'string') {
        const url = await saveLocalFile(file as File, 'documents');
        uploadedUrls.push(url);
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ message: 'No valid files were processed' }, { status: 400, headers: corsHeaders });
    }

    // If already PENDING_VERIFICATION (re-upload), REPLACE. Otherwise append.
    const isReupload = employee.verificationStatus === 'PENDING_VERIFICATION';
    const existingDocs = (!isReupload && Array.isArray(employee.documents)) ? (employee.documents as string[]) : [];
    const newDocs = [...new Set([...existingDocs, ...uploadedUrls])]; // deduplicate

    await prisma.user.update({
      where: { id: userId },
      data: {
        documents: newDocs,
        verificationStatus: 'PENDING_VERIFICATION',
      },
    });

    // Notify Admins/HR
    const adminsAndHR = await prisma.user.findMany({
      where: {
        OR: [
          { userType: 'Admin' },
          { designation: { contains: 'Admin' } },
          { designation: { contains: 'HR' } },
          { roles: { some: { name: { contains: 'Admin' } } } },
          { roles: { some: { name: { contains: 'HR' } } } },
          { customDesignation: { name: { contains: 'Admin' } } },
          { customDesignation: { name: { contains: 'HR' } } },
        ],
      },
      select: { id: true },
    });

    const notifications = adminsAndHR.map((admin) => ({
      userId: admin.id,
      titleEn: 'Document Verification Pending',
      titleBn: 'ডকুমেন্ট ভেরিফিকেশন বাকি',
      messageEn: `${employee.name} has uploaded documents for verification.`,
      messageBn: `${employee.name} ভেরিফিকেশনের জন্য ডকুমেন্ট আপলোড করেছেন।`,
      type: 'USER_VERIFICATION',
      referenceId: employee.id,
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
      notifications.forEach((n) => {
        eventEmitter.emit('new-notification', {
          ...n,
          id: Math.random().toString(36).substring(7),
          createdAt: new Date(),
          read: false,
        });
      });
    }

    return NextResponse.json(
      { message: 'Documents uploaded successfully', urls: uploadedUrls },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Upload Documents] Unexpected error:', error);
    return NextResponse.json({ message: 'Failed to upload documents' }, { status: 500, headers: corsHeaders });
  }
}

// ── DELETE: Remove a single document from user's list ────────────────────────
export async function DELETE(req: NextRequest) {
  const corsHeaders = getCorsHeaders();

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { docUrl } = await req.json();
    if (!docUrl) {
      return NextResponse.json({ message: 'docUrl is required' }, { status: 400, headers: corsHeaders });
    }

    const employee = await prisma.user.findUnique({ where: { id: userId } });
    if (!employee) {
      return NextResponse.json({ message: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    const existingDocs = Array.isArray(employee.documents) ? (employee.documents as string[]) : [];
    // Remove the specified URL and deduplicate remaining
    const updatedDocs = [...new Set(existingDocs.filter((d: string) => d !== docUrl))];

    await prisma.user.update({
      where: { id: userId },
      data: { documents: updatedDocs },
    });

    return NextResponse.json(
      { message: 'Document removed successfully', documents: updatedDocs },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Delete Document] Unexpected error:', error);
    return NextResponse.json({ message: 'Failed to delete document' }, { status: 500, headers: corsHeaders });
  }
}
