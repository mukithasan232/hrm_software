import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
