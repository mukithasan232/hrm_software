import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// ── Admin designation list (mirrors the rest of the codebase) ──────────────────
const ADMIN_DESIGNATIONS = [
  'admin',
  'super admin',
  'system administrator',
  'hrm manager',
];

function extractUser(req: Request): { id: string; designation?: string; roles?: any[] } | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return { id: decoded.id, designation: decoded.designation, roles: decoded.roles || [] };
  } catch {
    return null;
  }
}

async function isAdminUser(user: { id: string; designation?: string; roles?: any[] }): Promise<boolean> {
  const designName = typeof user.designation === 'object'
    ? (user.designation as any)?.name
    : user.designation;

  const byDesignation = ADMIN_DESIGNATIONS.includes((designName || '').toLowerCase().trim());
  const byRole = user.roles?.some((r: any) =>
    ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
  );

  if (byDesignation || byRole) return true;

  // ── Fallback: check DB (covers userType=SUPER_ADMIN / god-mode email) ────────
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (
      dbUser?.email === 'dev@fixanyphoto.com' ||
      dbUser?.userType === 'SUPER_ADMIN' ||
      dbUser?.designation === 'Super Admin'
    ) {
      return true;
    }
  } catch {
    // DB unreachable — fall through to deny
  }

  return false;
}

export async function PATCH(req: Request) {
  try {
    // ── Task 3 (Backend): Verify caller is an admin ────────────────────────────
    const tokenUser = extractUser(req);
    if (!tokenUser) {
      return NextResponse.json(
        { error: 'Unauthorized. A valid session token is required.' },
        { status: 401 }
      );
    }

    const admin = await isAdminUser(tokenUser);
    if (!admin) {
      return NextResponse.json(
        { error: 'Forbidden. Only administrators can approve or reject overtime.' },
        { status: 403 }
      );
    }
    // ──────────────────────────────────────────────────────────────────────────

    const { userId, date, otStatus } = await req.json();

    if (!userId || !date || !otStatus) {
      return NextResponse.json({ error: 'Missing required fields (userId, date, otStatus).' }, { status: 400 });
    }

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(otStatus)) {
      return NextResponse.json({ error: 'Invalid otStatus value.' }, { status: 400 });
    }

    // Parse the date (e.g., '2026-07-04')
    const targetDate = parseISO(date);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    // Fetch records first to calculate approvedOtMinutes if APPROVED
    const records = await prisma.attendanceLog.findMany({
      where: {
        employeeId: userId,
        timestamp: { gte: start, lte: end },
      },
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'Could not locate underlying records for this date.' },
        { status: 404 }
      );
    }

    // Calculate total valid hours for the day to determine OT minutes
    let firstCheckIn: (typeof records)[0] | null = null;
    let lastCheckOut: (typeof records)[0] | null = null;

    for (const log of records) {
      if (log.punchType === 'CheckIn') {
        if (!firstCheckIn || log.timestamp < firstCheckIn.timestamp) firstCheckIn = log;
      } else if (log.punchType === 'CheckOut') {
        if (!lastCheckOut || log.timestamp > lastCheckOut.timestamp) lastCheckOut = log;
      }
    }

    let approvedMinutes = 0;
    if (
      otStatus === 'APPROVED' &&
      firstCheckIn &&
      lastCheckOut &&
      lastCheckOut.timestamp > firstCheckIn.timestamp
    ) {
      const totalMs = lastCheckOut.timestamp.getTime() - firstCheckIn.timestamp.getTime();
      const standardShiftMs = 8 * 60 * 60 * 1000; // 8 hours
      const otMs = Math.max(0, totalMs - standardShiftMs);
      approvedMinutes = Math.floor(otMs / 60000);
    }

    // Update all punch records for this user on this specific date
    const updated = await prisma.attendanceLog.updateMany({
      where: {
        employeeId: userId,
        timestamp: { gte: start, lte: end },
      },
      data: {
        otStatus,
        approvedOtMinutes: approvedMinutes,
      },
    });

    return NextResponse.json({
      message: 'Overtime status updated successfully.',
      count: updated.count,
    });
  } catch (error: any) {
    console.error('OT UPDATE ERROR:', error);
    return NextResponse.json(
      { error: 'Internal server error during OT update.' },
      { status: 500 }
    );
  }
}
