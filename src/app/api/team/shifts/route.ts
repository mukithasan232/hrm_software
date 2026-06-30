import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';
import { checkPermission } from '@/utils/checkPermission';

export const OPTIONS = corsPreflight;

export const GET = wrapHandler(async (req: any, ctx: any) => {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ data: shifts });
  } catch (error: any) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}, { protect: true });

export const POST = wrapHandler(async (req: any, ctx: any) => {
  try {
    const user = req.user;
    const body = await req.request.json();
    const { name, startTime, endTime } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ message: "Name, startTime, and endTime are required" }, { status: 400 });
    }

    const newShift = await prisma.shift.create({
      data: {
        name: name.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
      }
    });

    return NextResponse.json({ data: newShift, message: "Shift created successfully" });
  } catch (error: any) {
    console.error("Error creating shift:", error);
    if (error.code === 'P2002') {
      return NextResponse.json({ message: "A shift with this name already exists." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}, { protect: true });
