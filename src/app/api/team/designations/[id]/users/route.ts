import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';
import { wrapHandler } from '@/lib/adapter';

// GET: Fetch users associated with this designation, and those who are not
async function getDesignationUsers(req: Request, res: any) {
  const designationId = (req as any).params?.id;

  try {
    const allUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        userType: 'Employee'
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        designationId: true,
        customDesignation: { select: { name: true } },
        profileImage: true,
      },
      orderBy: { name: 'asc' }
    });

    const currentUsers = allUsers.filter(u => u.designationId === designationId);
    const otherUsers = allUsers.filter(u => u.designationId !== designationId);

    return NextResponse.json({
      success: true,
      data: {
        currentUsers,
        otherUsers
      }
    });
  } catch (error: any) {
    console.error('Error fetching designation users:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Add a user to this designation
async function addUserToDesignation(req: Request, res: any) {
  const designationId = (req as any).params?.id;
  
  try {
    const body = await req.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    // Verify designation exists
    const designation = await prisma.designation.findUnique({ where: { id: designationId } });
    if (!designation) {
      return NextResponse.json({ success: false, message: 'Designation not found' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        designationId: designationId,
        designation: designation.name // keep legacy sync
      }
    });

    return NextResponse.json({ success: true, message: 'User added successfully', data: updatedUser });
  } catch (error: any) {
    console.error('Error adding user to designation:', error);
    return NextResponse.json({ success: false, message: 'Failed to add user' }, { status: 500 });
  }
}

// DELETE: Remove a user from this designation
async function removeUserFromDesignation(req: Request, res: any) {
  const designationId = (req as any).params?.id;
  
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        designationId: null,
        designation: null // keep legacy sync
      }
    });

    return NextResponse.json({ success: true, message: 'User removed successfully', data: updatedUser });
  } catch (error: any) {
    console.error('Error removing user from designation:', error);
    return NextResponse.json({ success: false, message: 'Failed to remove user' }, { status: 500 });
  }
}

export const GET = wrapHandler(getDesignationUsers, { protect: true });
export const POST = wrapHandler(addUserToDesignation, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager'] });
export const DELETE = wrapHandler(removeUserFromDesignation, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HRM Manager'] });
