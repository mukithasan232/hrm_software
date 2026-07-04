import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email') || 'dev@fixanyphoto.com';
    
    // Test 1: DB connection
    const user = await prisma.user.findFirst({
      where: { email }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found in DB.' });
    }

    // Test 2: Include relations (This crashes if DB schema is out of sync)
    const userFull = await prisma.user.findFirst({
      where: { email },
      include: {
        customDesignation: true,
        roles: true,
        userPermission: true,
        shift: true,
        customDepartment: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Database queries worked perfectly!",
      user: {
        id: userFull?.id,
        email: userFull?.email,
        designation: userFull?.customDesignation?.name
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'CRASH_IN_PRISMA',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
