import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const comments = await prisma.taskComment.findMany({
      where: { taskId: params.taskId },
      include: { user: { select: { id: true, name: true, profileImage: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const body = await req.json();
    const { text, userId } = body;

    if (!text || !userId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const newComment = await prisma.taskComment.create({
      data: {
        text,
        taskId: params.taskId,
        userId: userId,
      },
      include: { user: { select: { id: true, name: true, profileImage: true } } }
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Failed to post comment:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
