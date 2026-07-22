import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';

export const PATCH = wrapHandler(async (req: any, res: any) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = authUser.role?.toUpperCase().includes('ADMIN') || 
                    authUser.roles?.some((r: any) => r.name?.toUpperCase().includes('ADMIN')) || 
                    String(authUser.designation || '').toUpperCase().includes('ADMIN') ||
                    authUser.userType?.toUpperCase().includes('ADMIN');

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

    const designation = await prisma.designation.findFirst({
      where: { name: role }
    });

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
