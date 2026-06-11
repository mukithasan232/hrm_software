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
    include: { 
      role: { include: { permissions: true } },
      userPermissions: true
    }
  });

  if (!dbUser || (!dbUser.role && (!dbUser.userPermissions || dbUser.userPermissions.length === 0))) {
    return NextResponse.json({ role: null, permissions: [] });
  }

  // Merge logic: user permissions override role permissions
  const rolePerms = dbUser.role?.permissions || [];
  const userPerms = dbUser.userPermissions || [];

  const mergedMap = new Map();
  
  // Add role permissions first
  rolePerms.forEach((p: any) => {
    mergedMap.set(p.moduleName, {
      moduleName: p.moduleName,
      canRead: p.canRead,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    });
  });

  // Override with user permissions
  userPerms.forEach((p: any) => {
    mergedMap.set(p.moduleName, {
      moduleName: p.moduleName,
      canRead: p.canRead,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    });
  });

  const mergedPermissions = Array.from(mergedMap.values());

  return NextResponse.json({
    role: dbUser.role?.name || 'Custom',
    permissions: mergedPermissions
  });
};

export const GET = wrapHandler(getPermissions, { protect: true });
