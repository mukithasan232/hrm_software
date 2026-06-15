import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';

// Fallback JSON structure required by frontend
const MODULES = ['Emails', 'Users', 'Attendance', 'Teams', 'Leaves', 'Payroll'];
const getFallbackMatrix = () => {
  return MODULES.map(mod => ({
    moduleName: mod,
    canRead: false,
    canCreate: false,
    canEdit: false,
    canDelete: false
  }));
};

const getPermissions = async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;

    const userPerms = await (prisma as any).userPermission.findUnique({
      where: { userId: id }
    });

    if (!userPerms || !userPerms.matrix) {
      return NextResponse.json(getFallbackMatrix());
    }

    const matrix = userPerms.matrix as any;
    const responseArray = Object.keys(matrix).map(mod => ({
      moduleName: mod,
      canRead: matrix[mod].canRead || false,
      canCreate: matrix[mod].canCreate || false,
      canEdit: matrix[mod].canEdit || false,
      canDelete: matrix[mod].canDelete || false,
    }));

    // Merge missing modules
    MODULES.forEach(mod => {
      if (!matrix[mod]) {
        responseArray.push({
          moduleName: mod,
          canRead: false,
          canCreate: false,
          canEdit: false,
          canDelete: false
        });
      }
    });

    return NextResponse.json(responseArray);
  } catch (error) {
    console.error('API Error: GET /permissions', error);
    return NextResponse.json(getFallbackMatrix()); // Return fallback even on error
  }
};

const postPermissions = async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const body = await req.json();
    const { matrix } = body;

    if (!matrix) {
      return NextResponse.json({ error: 'Matrix is required' }, { status: 400 });
    }

    const updated = await (prisma as any).userPermission.upsert({
      where: { userId: id },
      update: { matrix },
      create: {
        userId: id,
        matrix
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('API Error: POST /permissions', error);
    return NextResponse.json({ error: 'Failed to save permissions' }, { status: 500 });
  }
};

export const GET = wrapHandler(getPermissions, { protect: true });
export const POST = wrapHandler(postPermissions, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager'] });
