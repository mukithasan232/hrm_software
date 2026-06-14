import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getRoles = async (req: any, res: any) => {
  const roles = await prisma.role.findMany();
  return NextResponse.json(roles);
};

const upsertRole = async (req: any, res: any) => {
  const body = req.body;
  const { id, name, description, matrix } = body;

  if (!name || !matrix) {
    return NextResponse.json({ error: 'Name and matrix are required' }, { status: 400 });
  }

  // matrix is an object: { [moduleName]: { Read, Create, Edit, Delete } }
  // We just store it as Json now
  const permissionsData = matrix;

  if (id) {
    // Update existing role
    await prisma.role.update({
      where: { id },
      data: { name, description, permissions: permissionsData }
    });
  } else {
    // Create new role
    await prisma.role.create({
      data: {
        name,
        description,
        permissions: permissionsData
      }
    });
  }

  return NextResponse.json({ success: true });
};

export const GET = wrapHandler(getRoles, { protect: true, allowedDesignations: ['Admin', 'Super Admin'] });
export const POST = wrapHandler(upsertRole, { protect: true, allowedDesignations: ['Admin', 'Super Admin'] });
