export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';
import { getPermissionScopeSync } from '@/utils/checkPermission';
import { eventEmitter } from '@/lib/eventEmitter';
import { sendEventEmail } from '@/lib/mail-utils';

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
    const scope = getPermissionScopeSync(mockReq.user, 'Tasks', 'read');
    console.log(`[Tasks GET] user=${mockReq.user.id} scope=${scope}`);

    if (scope === 'no') {
      return NextResponse.json(
        { message: 'Permission denied for Tasks module' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const { getScopedWhereClause } = await import('@/utils/checkPermission');
    const securityScope = getScopedWhereClause(mockReq.user, 'Tasks', 'read', 'assignedToId');

    const frontendFilters = {}; // Future frontend filters go here
    
    // ── 3. Query ──────────────────────────────────────────────────────────────
    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          securityScope,
          frontendFilters
        ]
      },
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

    const scope = getPermissionScopeSync(mockReq.user, 'Tasks', 'create');
    if (scope === 'no') {
      return NextResponse.json({ message: 'Permission denied to create tasks' }, { status: 403, headers: getCorsHeaders() });
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
        attachment: mockReq.file?.attachment?.path || null,
      },
      include: TASK_INCLUDE,
    });

    // Inject notification for the assigned user
    const safeTitle = task.title.length > 50 ? task.title.substring(0, 47) + '...' : task.title;
    const newNotification = await prisma.notification.create({
      data: {
        userId: assignedToId,
        titleEn: 'New Task Assigned',
        titleBn: 'নতুন টাস্ক দেওয়া হয়েছে',
        messageEn: `You have been assigned a new task: "${safeTitle}"`,
        messageBn: `আপনাকে একটি নতুন টাস্ক দেওয়া হয়েছে: "${safeTitle}"`,
        type: 'TASK',
        referenceId: task.id
      }
    });

    eventEmitter.emit('new-notification', newNotification);

    // ── Email Notification Dispatch ──
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { email: true, name: true, notificationPrefs: true } });
    if (!assignee?.email) {
        console.log("No email found for assignee, skipping email notification.");
    } else {
        try {
            console.log(`Attempting to send Task email to ${assignee.email}...`);
            const isSent = await sendEventEmail(assignedToId, 'emailOnTask', {
                subject: 'New Task Assigned',
                html: `<p>Hi ${assignee.name || 'Team Member'},</p><p>You have been assigned a new task: <strong>${task.title}</strong></p>`
            });
            if (isSent) {
                console.log("Task email sent successfully!");
            } else {
                console.log("Task email could not be sent (check SMTP logs or preferences).");
            }
        } catch (emailError) {
            console.error("FAILED to send task email. SMTP Error:", emailError);
        }
    }

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
