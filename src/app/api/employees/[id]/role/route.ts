import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';
import { checkPermission } from '@/utils/checkPermission';
export const PATCH = wrapHandler(async (req: any, res: any) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = checkPermission(authUser, 'employees', 'edit');

    if (!isAdmin) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const { id } = req.params;
    
    // Prevent self-demotion
    if (String(authUser.id) === String(id)) {
      return NextResponse.json({ success: false, message: 'You cannot change your own role' }, { status: 400 });
    }

    const { role } = req.body || {}; // e.g., 'Admin' or 'Employee'

    if (!role) {
      return NextResponse.json({ success: false, message: 'Role is required' }, { status: 400 });
    }

    const designations = await prisma.designation.findMany();
    const designation = designations.find((d: any) => d.name?.toLowerCase() === role?.toLowerCase());

    const updateData: any = {
      userType: role
    };

    if (designation) {
      updateData.designationId = designation.id;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'Role updated successfully', user: updatedUser });
  } catch (error: any) {
    console.error('Error updating role:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
});
