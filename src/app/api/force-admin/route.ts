export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const email = 'dev@fixanyphoto.com';

    // 1. Try to find the SUPER_ADMIN role in the Role table (if it exists)
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'SUPER_ADMIN' }
    });

    // 2. Update the user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        designation: 'Super Admin',
        userType: 'SUPER_ADMIN',
        ...(superAdminRole && {
          roles: {
            connect: { id: superAdminRole.id }
          }
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Developer account forcefully upgraded to SUPER_ADMIN',
      user: {
        email: updatedUser.email,
        designation: updatedUser.designation,
        userType: updatedUser.userType
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
