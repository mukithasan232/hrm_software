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

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders();

  try {
    // ── Auth: extract JWT from Authorization header ──────────────────────
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = authHeader.split(' ')[1];
    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
      userId = decoded.id;
    } catch {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401, headers: corsHeaders });
    }

    // ── Verify employee exists ────────────────────────────────────────────
    const employee = await prisma.user.findUnique({ where: { id: userId } });
    if (!employee) {
      return NextResponse.json({ message: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    // ── Parse multipart/form-data directly from NextRequest ───────────────
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

    // ── Save each file ────────────────────────────────────────────────────
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

    // ── Append to existing docs and set status to PENDING_VERIFICATION ────
    const existingDocs = Array.isArray(employee.documents) ? (employee.documents as string[]) : [];
    const newDocs = [...existingDocs, ...uploadedUrls];

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        documents: newDocs,
        verificationStatus: 'PENDING_VERIFICATION',
      },
    });

    // --- Create notifications for Admins/HR ---
    const adminsAndHR = await prisma.user.findMany({
      where: {
        OR: [
          { userType: 'Admin' },
          { designation: { contains: 'Admin' } },
          { designation: { contains: 'HR' } },
          { roles: { some: { name: { contains: 'Admin' } } } },
          { roles: { some: { name: { contains: 'HR' } } } },
          { customDesignation: { name: { contains: 'Admin' } } },
          { customDesignation: { name: { contains: 'HR' } } }
        ]
      },
      select: { id: true }
    });

    const notifications = adminsAndHR.map(admin => ({
      userId: admin.id,
      titleEn: 'Document Verification Pending',
      titleBn: 'ডকুমেন্ট ভেরিফিকেশন বাকি',
      messageEn: `${employee.name} has uploaded documents for verification.`,
      messageBn: `${employee.name} ভেরিফিকেশনের জন্য ডকুমেন্ট আপলোড করেছেন।`,
      type: 'USER_VERIFICATION',
      referenceId: employee.id,
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
      notifications.forEach((n) => {
        eventEmitter.emit('new-notification', { ...n, id: Math.random().toString(36).substring(7), createdAt: new Date(), read: false });
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
