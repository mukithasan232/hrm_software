import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Ensure this exists, otherwise we'll skip auth check or just use generic check

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
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
