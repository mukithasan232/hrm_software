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
    include: { roles: true } as any
  });

  if (!dbUser || !(dbUser as any).roles || (dbUser as any).roles.length === 0) {
    return NextResponse.json({ role: null, permissions: [] });
  }

  const mergedMap = new Map();

  (dbUser as any).roles.forEach((role: any) => {
    const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
    if (!perms) return;

    Object.keys(perms).forEach(moduleName => {
      const p = perms[moduleName];
      const existing = mergedMap.get(moduleName) || { canRead: false, canCreate: false, canEdit: false, canDelete: false };
      
      mergedMap.set(moduleName, {
        moduleName,
        canRead: existing.canRead || (p.Read && p.Read !== 'No' && p.Read !== 'Not Set'),
        canCreate: existing.canCreate || (p.Create && p.Create !== 'No' && p.Create !== 'Not Set'),
        canEdit: existing.canEdit || (p.Edit && p.Edit !== 'No' && p.Edit !== 'Not Set'),
        canDelete: existing.canDelete || (p.Delete && p.Delete !== 'No' && p.Delete !== 'Not Set'),
      });
    });
  });

  const mergedPermissions = Array.from(mergedMap.values());
  const roleNames = (dbUser as any).roles.map((r: any) => r.name).join(', ');

  return NextResponse.json({
    role: roleNames || 'Custom',
    permissions: mergedPermissions
  });
};

export const GET = wrapHandler(getPermissions, { protect: true });
