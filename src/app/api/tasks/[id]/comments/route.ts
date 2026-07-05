import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/adapter';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      include: { user: { select: { id: true, name: true, profileImage: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(comments, { headers: getCorsHeaders() });
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { text, userId } = body;

    if (!text || !userId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400, headers: getCorsHeaders() });
    }

    const newComment = await prisma.taskComment.create({
      data: {
        text,
        taskId: id,
        userId: userId,
      },
      include: { user: { select: { id: true, name: true, profileImage: true } } }
    });

    return NextResponse.json(newComment, { status: 201, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Failed to post comment:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
