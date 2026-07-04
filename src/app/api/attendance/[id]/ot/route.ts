import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 

export const dynamic = 'force-dynamic';
export const revalidate = 0; 

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { otStatus } = await req.json();
    
    // Fetch the raw record to calculate exact minutes safely
    const record = await prisma.attendanceLog.findUnique({ where: { id: params.id } });
    if (!record || !record.timestamp || !(record as any).checkOut) {
        return NextResponse.json({ error: "Invalid punch record or shift not completed" }, { status: 400 });
    }

    let approvedMinutes = 0;
    
    if (otStatus === 'APPROVED') {
      const totalMs = (record as any).checkOut.getTime() - record.timestamp.getTime();
      const standardShiftMs = 8 * 60 * 60 * 1000; // 8 Hours
      const otMs = Math.max(0, totalMs - standardShiftMs);
      approvedMinutes = Math.floor(otMs / 60000);
    }

    const updated = await prisma.attendanceLog.update({
      where: { id: params.id },
      data: { otStatus, approvedOtMinutes: approvedMinutes } as any
    });

    return NextResponse.json({ message: "Success", data: updated });
  } catch (error) {
    console.error("OT Update Error:", error);
    return NextResponse.json({ error: "Failed to update OT status" }, { status: 500 });
  }
}
