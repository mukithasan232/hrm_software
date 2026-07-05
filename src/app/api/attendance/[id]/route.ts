import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    
    // Convert to null if empty, otherwise parse to Date
    const checkInDate = checkIn ? new Date(checkIn) : null;
    const checkOutDate = checkOut ? new Date(checkOut) : null;

    // Use prisma.attendanceLog based on our actual schema
    const updated = await prisma.attendanceLog.update({
      where: { id },
      data: {
        timestamp: checkInDate || undefined, 
        checkOut: checkOutDate
      } as any
    });
    return NextResponse.json({ message: "Updated", data: updated });
  } catch (error) {
    console.error("Failed to update attendance log:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Invalid Record ID provided." }, { status: 400 });
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
