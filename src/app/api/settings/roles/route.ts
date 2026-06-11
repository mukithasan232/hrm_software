import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getRoles = async (req: Request) => {
  const roles = await prisma.role.findMany({
    include: { permissions: true }
  });
  return NextResponse.json(roles);
};

const upsertRole = async (req: Request) => {
  const body = await req.json();
  const { id, name, description, matrix } = body;

  if (!name || !matrix) {
    return NextResponse.json({ error: 'Name and matrix are required' }, { status: 400 });
  }

  // matrix is an object: { [moduleName]: { canRead, canCreate, canEdit, canDelete } }
  const permissionsData = Object.entries(matrix).map(([moduleName, perms]: any) => ({
    moduleName,
    canRead: perms.canRead,
    canCreate: perms.canCreate,
    canEdit: perms.canEdit,
    canDelete: perms.canDelete,
  }));

  if (id) {
    // Update existing role
    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name, description }
      });
      // Delete old permissions to replace them
      await tx.permission.deleteMany({
        where: { roleId: id }
      });
      // Insert new permissions
      await tx.permission.createMany({
        data: permissionsData.map(p => ({ ...p, roleId: id }))
      });
    });
  } else {
    // Create new role
    await prisma.role.create({
      data: {
        name,
        description,
        permissions: {
          create: permissionsData
        }
      }
    });
  }

  return NextResponse.json({ success: true });
};

export const GET = wrapHandler(getRoles, { protect: true, adminOnly: true });
export const POST = wrapHandler(upsertRole, { protect: true, adminOnly: true });
