export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';
import { getPermissionScope } from '@/lib/permissions';

const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];

function isAdmin(user: any): boolean {
  const designName = typeof user?.designation === 'string'
    ? user.designation
    : (user?.designation as any)?.name || '';
  const userDesig = designName.toLowerCase().trim();
  const hasAdminRole = user?.roles?.some((r: any) =>
    ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
  );
  return ADMIN_DESIGNATIONS.includes(userDesig) || hasAdminRole;
}

export async function GET(req: NextRequest) {
  try {
    const mockReq = await parseRequest(req);

    if (!mockReq.user) {
      return NextResponse.json(
        { message: 'Not authorized, token missing or invalid' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    if (!isAdmin(mockReq.user)) {
      return NextResponse.json(
        { message: 'Permission denied. Admins only.' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // 1. Fetch recent tasks
    const tasksPromise = prisma.task.findMany({
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedTo: { select: { name: true, profileImage: true } },
      }
    });

    // 2. Fetch recent attendance logs
    const attendancePromise = prisma.attendanceLog.findMany({
      take: 50,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { name: true, profileImage: true } },
      }
    });

    // 3. Fetch recent leaves
    const leavesPromise = prisma.leave.findMany({
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true, profileImage: true } },
      }
    });

    const [tasks, attendanceLogs, leaves] = await Promise.all([
      tasksPromise,
      attendancePromise,
      leavesPromise
    ]);

    // Map and Merge
    const streamItems: any[] = [];

    for (const t of tasks) {
      streamItems.push({
        id: `task-${t.id}`,
        type: 'TASK',
        actionContext: `Task '${t.title}' is currently ${t.status}`,
        user: t.assignedTo,
        timestamp: t.updatedAt,
        metadata: {
          status: t.status,
          priority: t.priority
        }
      });
    }

    for (const a of attendanceLogs) {
      streamItems.push({
        id: `att-${a.id}`,
        type: 'ATTENDANCE',
        actionContext: `Punched ${a.punchType} at ${a.locationAddress || (a.deviceId ? 'Device' : 'Web')}`,
        user: a.user,
        timestamp: a.timestamp,
        metadata: {
          punchType: a.punchType,
          workMode: a.workMode
        }
      });
    }

    for (const l of leaves) {
      streamItems.push({
        id: `leave-${l.id}`,
        type: 'LEAVE',
        actionContext: `Leave Request (${l.type}) is ${l.status}`,
        user: l.user,
        timestamp: l.updatedAt,
        metadata: {
          status: l.status,
          type: l.type,
          totalDays: l.totalDays
        }
      });
    }

    // Sort by timestamp descending
    streamItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Return top 100 records max
    return NextResponse.json(streamItems.slice(0, 100), { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('GLOBAL_STREAM_ERROR:', error);
    return NextResponse.json(
      { message: error?.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
