import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { employeeId: id }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationStatus: 'UNVERIFIED',
        appointmentLetter: null,
      }
    });

    return NextResponse.json({ message: "Reset successful", user: updatedUser });
  } catch (error) {
    console.error("Failed to reset verification:", error);
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }
}
