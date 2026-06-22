export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';

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

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const mockReq = await parseRequest(req);

    if (!mockReq.user) {
      console.warn('[Tasks GET] Unauthorized — no valid JWT in Authorization header');
      return NextResponse.json(
        { message: 'Not authorized, token missing or invalid' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // ── 2. Build Prisma filter ────────────────────────────────────────────────
    const admin = isAdmin(mockReq.user);
    const where = admin ? {} : { assignedToId: mockReq.user.id };

    console.log(`[Tasks GET] user=${mockReq.user.id} isAdmin=${admin}`);

    // ── 3. Query ──────────────────────────────────────────────────────────────
    const tasks = await prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[Tasks GET] Returning ${tasks.length} tasks`);
    return NextResponse.json(tasks, { headers: getCorsHeaders() });

  } catch (error: any) {
    // ── Detailed diagnostic — visible in Next.js terminal ────────────────────
    console.error('TASK_FETCH_ERROR:', error?.message || error);
    console.error('TASK_FETCH_ERROR code:', error?.code);
    console.error('TASK_FETCH_ERROR stack:', error?.stack);
    return NextResponse.json(
      { message: error?.message || 'Internal server error', code: error?.code },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const mockReq = await parseRequest(req);

    if (!mockReq.user) {
      console.warn('[Tasks POST] Unauthorized — no valid JWT');
      return NextResponse.json(
        { message: 'Not authorized, token missing or invalid' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    if (!isAdmin(mockReq.user)) {
      return NextResponse.json({ message: 'Admin only' }, { status: 403, headers: getCorsHeaders() });
    }

    const { title, description, startDate, dueDate, status, priority, assignedToId } = mockReq.body;

    if (!title?.trim()) {
      return NextResponse.json({ message: 'Title is required' }, { status: 400, headers: getCorsHeaders() });
    }
    if (!assignedToId) {
      return NextResponse.json({ message: 'Assigned user is required' }, { status: 400, headers: getCorsHeaders() });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'TODO',
        priority: priority || 'NORMAL',
        assignedToId,
        createdById: mockReq.user.id,
      },
      include: TASK_INCLUDE,
    });

    return NextResponse.json(task, { status: 201, headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('TASK_CREATE_ERROR:', error?.message || error);
    console.error('TASK_CREATE_ERROR code:', error?.code);
    return NextResponse.json(
      { message: error?.message || 'Internal server error', code: error?.code },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
