import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getRoles = async (req: any, res: any) => {
  const roles = await prisma.designation.findMany();
  return NextResponse.json(roles);
};

const upsertRole = async (req: any, res: any) => {
  const body = req.body;
  const { id, name, description, matrix, weekendDays } = body;

  if (!name || !matrix) {
    return NextResponse.json({ error: 'Name and matrix are required' }, { status: 400 });
  }

  // matrix is an object: { [moduleName]: { Read, Create, Edit, Delete } }
  // We just store it as Json now
  const permissionsData = matrix;
  
  const finalWeekendDays = Array.isArray(weekendDays) ? weekendDays : ["Sunday"];

  if (id) {
    // Update existing designation
    await prisma.designation.update({
      where: { id },
      data: { name, description, permissions: permissionsData, weekendDays: finalWeekendDays } as any
    });
  } else {
    // Create new designation
    await prisma.designation.create({
      data: {
        name,
        description,
        permissions: permissionsData,
        weekendDays: finalWeekendDays
      } as any
    });
  }

  return NextResponse.json({ success: true });
};

export const GET = wrapHandler(getRoles, { protect: true, allowedDesignations: ['Admin', 'Super Admin'] });
export const POST = wrapHandler(upsertRole, { protect: true, allowedDesignations: ['Admin', 'Super Admin'] });
