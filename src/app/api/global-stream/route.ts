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
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

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
      take: 200,
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedTo: { select: { name: true, profileImage: true } },
      }
    });

    // 2. Fetch recent attendance logs
    const attendancePromise = prisma.attendanceLog.findMany({
      take: 200,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { name: true, profileImage: true } },
      }
    });

    // 3. Fetch recent leaves
    const leavesPromise = prisma.leave.findMany({
      take: 200,
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
      // 1. Always push the Check-In event
      streamItems.push({
        id: `att-in-${a.id}`,
        type: 'ATTENDANCE',
        actionContext: `Checked In at ${a.locationAddress || (a.deviceId ? 'Device' : 'Web')}`,
        user: a.user,
        timestamp: a.timestamp,
        metadata: {
          punchType: 'CheckIn',
          workMode: a.workMode
        }
      });

      // 2. If they have checked out, push a separate Check-Out event
      if (a.checkOut) {
        streamItems.push({
          id: `att-out-${a.id}`,
          type: 'ATTENDANCE',
          actionContext: `Checked Out at ${a.locationAddress || (a.deviceId ? 'Device' : 'Web')}`,
          user: a.user,
          timestamp: a.checkOut,
          metadata: {
            punchType: 'CheckOut',
            workMode: a.workMode
          }
        });
      }
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

    // Calculate Pagination
    const totalRecords = streamItems.length;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Slice for the requested page
    const paginatedData = streamItems.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      data: paginatedData,
      meta: { currentPage: page, totalPages, totalRecords }
    }, { headers: getCorsHeaders() });

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
