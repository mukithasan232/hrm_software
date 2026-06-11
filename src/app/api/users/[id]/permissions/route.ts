import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getUserPermissions = async (req: any, res: any) => {
  const { id } = req.params;
  
  const userPerms = await prisma.userPermission.findMany({
    where: { userId: id }
  });
  
  return NextResponse.json(userPerms);
};

const upsertUserPermissions = async (req: any, res: any) => {
  const { id } = req.params;
  const body = await req.json();
  const { matrix } = body;

  if (!matrix) {
    return NextResponse.json({ error: 'Matrix is required' }, { status: 400 });
  }

  // matrix is an object: { [moduleName]: { canRead, canCreate, canEdit, canDelete } }
  const permissionsData = Object.entries(matrix).map(([moduleName, perms]: any) => ({
    userId: id,
    moduleName,
    canRead: perms.canRead,
    canCreate: perms.canCreate,
    canEdit: perms.canEdit,
    canDelete: perms.canDelete,
  }));

  await prisma.$transaction(async (tx: any) => {
    // Delete existing custom permissions for this user
    await tx.userPermission.deleteMany({
      where: { userId: id }
    });
    
    // Insert new custom permissions
    // If a user deletes an override, they just send it as part of the normal flow? Or we just delete all and insert what is provided.
    // However, if the matrix only contains what they explicitly override, we should only insert those.
    // Let's assume the frontend sends the full matrix of overrides (or those explicitly set).
    // The simplest way is to delete all and insert the ones provided in `matrix` where at least one permission is true, or even if false (to explicitly deny).
    await tx.userPermission.createMany({
      data: permissionsData
    });
  });

  return NextResponse.json({ success: true });
};

export const GET = wrapHandler(getUserPermissions, { protect: true, adminOnly: true });
export const POST = wrapHandler(upsertUserPermissions, { protect: true, adminOnly: true });
