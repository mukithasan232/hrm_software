import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { checkIn, checkOut } = await req.json();
    
    // Convert to null if empty, otherwise parse to Date
    const checkInDate = checkIn ? new Date(checkIn) : null;
    const checkOutDate = checkOut ? new Date(checkOut) : null;

    // Use prisma.attendanceLog based on our actual schema
    const updated = await prisma.attendanceLog.update({
      where: { id: params.id },
      data: {
        timestamp: checkInDate || undefined, 
        checkOut: checkOutDate
      }
    });
    return NextResponse.json({ message: "Updated", data: updated });
  } catch (error) {
    console.error("Failed to update attendance log:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.attendanceLog.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Failed to delete attendance log:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
