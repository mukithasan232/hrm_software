import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { parseRequest, getCorsHeaders } from '@/lib/adapter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function GET(req: NextRequest) {
  try {
    const mockReq = await parseRequest(req);
    
    if (!mockReq.user) {
      return NextResponse.json({ message: 'Not authorized' }, { status: 401, headers: getCorsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');
    
    const admin = isAdmin(mockReq.user);
    // If it's an employee, FORCE their own userId. If Admin, allow an optional filter or show all.
    let userId = searchParams.get('userId');
    if (!admin) {
      userId = mockReq.user.id;
    }

    // 🚀 1. TIMEZONE AWARE BOUNDARIES (Asia/Dhaka)
    const timeZone = 'Asia/Dhaka';
    const nowInBD = toZonedTime(new Date(), timeZone);

    let queryStartDate = startOfDay(nowInBD);
    let queryEndDate = endOfDay(nowInBD);

    if (startParam && endParam) {
      queryStartDate = startOfDay(parseISO(startParam));
      queryEndDate = endOfDay(parseISO(endParam));
    }

    // 🚀 2. DYNAMIC WHERE CLAUSE
    const whereClause: any = {
      status: 'COMPLETED',
      completedAt: {
        gte: queryStartDate,
        lte: queryEndDate,
      },
    };

    if (userId) {
      whereClause.assignedToId = userId;
    }

    const completedTasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: { name: true, email: true, employeeId: true }
        }
      },
      orderBy: { completedAt: 'desc' } as any
    });

    return NextResponse.json({
      count: completedTasks.length,
      tasks: completedTasks,
      range: { start: queryStartDate, end: queryEndDate }
    }, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('[Tasks Analytics GET]', error);
    return NextResponse.json({ error: "Failed to fetch task metrics" }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
