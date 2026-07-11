import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest } from '@/lib/adapter';

const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];

function isAdmin(user: any): boolean {
  if (!user) return false;
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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Invalid Record ID provided." }, { status: 400 });
    }

    const existingRecord = await prisma.attendanceLog.findUnique({ where: { id } });
    if (!existingRecord) {
       return NextResponse.json({ error: "Record does not exist in the database." }, { status: 404 });
    }

    const { checkIn, checkOut } = await req.json();

    // Use prisma.attendanceLog based on our actual schema
    // Bypassing native new Date() parsing to prevent timezone offset shifts
    const updated = await prisma.attendanceLog.update({
      where: { id },
      data: {
        timestamp: checkIn || undefined, 
        checkOut: checkOut || null
      } as any
    });
    return NextResponse.json({ message: "Updated", data: updated });
  } catch (error) {
    console.error("Failed to update attendance log:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Invalid Record ID provided." }, { status: 400 });
    }

    const mockReq = await parseRequest(req, { id });
    if (!isAdmin(mockReq.user)) {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const existingRecord = await prisma.attendanceLog.findUnique({ where: { id } });
    if (!existingRecord) {
       return NextResponse.json({ error: "Record does not exist in the database." }, { status: 404 });
    }

    await prisma.attendanceLog.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Failed to delete attendance log:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
