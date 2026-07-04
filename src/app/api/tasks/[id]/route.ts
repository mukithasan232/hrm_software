export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';
import { saveLocalFile } from '@/lib/fileUploader';
import fs from 'fs/promises';
import path from 'path';

const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];

function isAdmin(user: any): boolean {
  const designName =
    typeof user?.designation === 'string'
      ? user.designation
      : (user?.designation as any)?.name || '';
  const userDesig = designName.toLowerCase().trim();
  const hasAdminRole = user?.roles?.some((r: any) =>
    ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
  );
  return ADMIN_DESIGNATIONS.includes(userDesig) || hasAdminRole;
}

const TASK_INCLUDE = {
  assignedTo: { select: { id: true, name: true, profileImage: true, employeeId: true } },
  createdBy:  { select: { id: true, name: true } },
} as const;

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reqClone = req.clone();
    const mockReq = await parseRequest(req, { id });

    let uploadedFiles: { name: string; url: string }[] = [];
    try {
      const formData = await reqClone.formData();
      const files = formData.getAll('outputFiles') as File[];
      if (files && files.length > 0) {
        const uploadPromises = files.map(file => saveLocalFile(file, 'tasks'));
        const urls = await Promise.all(uploadPromises);
        uploadedFiles = files.map((f, i) => ({ name: f.name, url: urls[i] }));
      }
    } catch (e) {
      // Ignore if not multipart or parsing fails
    }

    if (!mockReq.user) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 401, headers: getCorsHeaders() });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404, headers: getCorsHeaders() });
    }

    let currentOutputFiles = (task as any).outputFiles || [];
    if (typeof currentOutputFiles === 'string') {
      try { currentOutputFiles = JSON.parse(currentOutputFiles); } catch (e) { currentOutputFiles = []; }
    }
    const finalOutputFiles = [...currentOutputFiles, ...uploadedFiles];

    const admin = isAdmin(mockReq.user);

    if (!admin) {
      // Employee: can only update status/description/outputFiles, and only if the task is assigned to them
      if (task.assignedToId !== mockReq.user.id) {
        return NextResponse.json({ message: 'Not authorized to update this task' }, { status: 403, headers: getCorsHeaders() });
      }

      const { status, description } = mockReq.body;
      if (!status) {
        return NextResponse.json({ message: 'Status is required' }, { status: 400, headers: getCorsHeaders() });
      }

      const updated = await prisma.task.update({
        where: { id },
        data: { 
          status,
          ...(status === 'COMPLETED' ? { completedAt: new Date() } : { completedAt: null }),
          ...(description !== undefined && { description: description || null }),
          ...(uploadedFiles.length > 0 && { outputFiles: finalOutputFiles }),
        } as any,
        include: TASK_INCLUDE,
      });
      return NextResponse.json(updated, { headers: getCorsHeaders() });
    }

    // Admin: can update all fields
    const { title, description, startDate, dueDate, status, priority, assignedToId } = mockReq.body;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined       && { title: title.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(startDate !== undefined   && { startDate: startDate ? new Date(startDate) : null }),
        ...(dueDate !== undefined     && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status !== undefined      && { status }),
        ...(status !== undefined      && { completedAt: status === 'COMPLETED' ? new Date() : null }),
        ...(priority !== undefined    && { priority }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(mockReq.file?.attachment?.path && { attachment: mockReq.file.attachment.path }),
        ...(uploadedFiles.length > 0 && { outputFiles: finalOutputFiles }),
      } as any,
      include: TASK_INCLUDE,
    });

    return NextResponse.json(updated, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Tasks PATCH]', error);
    return NextResponse.json({ message: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mockReq = await parseRequest(req, { id });

    if (!mockReq.user) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 401, headers: getCorsHeaders() });
    }

    if (!isAdmin(mockReq.user)) {
      return NextResponse.json({ message: 'Admin only' }, { status: 403, headers: getCorsHeaders() });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ message: 'Task deleted' }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Tasks DELETE]', error);
    return NextResponse.json({ message: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
