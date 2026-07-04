import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, url, iconUrl } = body;

    const updatedApp = await (prisma as any).connectedApp.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(iconUrl !== undefined && { iconUrl })
      }
    });

    return NextResponse.json(updatedApp);
  } catch (error: any) {
    console.error("PUT ConnectedApp Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to update connected app' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await (prisma as any).connectedApp.delete({
      where: { id }
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("DELETE ConnectedApp Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to delete connected app' }, { status: 500 });
  }
}
