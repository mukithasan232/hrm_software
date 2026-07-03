export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mockReq = await parseRequest(req, { id });

    if (!mockReq.user) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 401, headers: getCorsHeaders() });
    }

    const { text } = mockReq.body;
    if (!text || !text.trim()) {
      return NextResponse.json({ message: 'Message text is required' }, { status: 400, headers: getCorsHeaders() });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404, headers: getCorsHeaders() });
    }

    let currentComments = (task as any).comments || [];
    if (typeof currentComments === 'string') {
      try { currentComments = JSON.parse(currentComments); } catch (e) { currentComments = []; }
    }

    const newComment = {
      text: text.trim(),
      user: {
        id: mockReq.user.id,
        name: mockReq.user.name,
        email: mockReq.user.email
      },
      createdAt: new Date().toISOString()
    };

    const updatedComments = [...currentComments, newComment];

    const updated = await prisma.task.update({
      where: { id },
      data: { comments: updatedComments },
      include: {
        assignedTo: { select: { id: true, name: true, profileImage: true, employeeId: true } },
        createdBy:  { select: { id: true, name: true } },
      }
    });

    return NextResponse.json(updated, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Task Comments POST]', error);
    return NextResponse.json({ message: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
