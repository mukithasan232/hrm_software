import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getPermissions = async (req: Request) => {
  const user = (req as any).user;
  if (!user || !user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { role: { include: { permissions: true } } }
  });

  if (!dbUser || !dbUser.role) {
    return NextResponse.json({ role: null, permissions: [] });
  }

  return NextResponse.json({
    role: dbUser.role.name,
    permissions: dbUser.role.permissions
  });
};

export const GET = wrapHandler(getPermissions, { protect: true });
