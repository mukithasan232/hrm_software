import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withZKConnection } from '@/services/zkService';

export async function GET() {
  try {
    // 1. Fetch DB users with enroll numbers
    // @ts-ignore
    const dbUsers = await prisma.user.findMany({
      where: {
        NOT: {
          zk_enroll_number: null
        }
      },
      select: {
        id: true,
        name: true,
        zk_enroll_number: true
      }
    });

    const dbMap = new Map();
    for (const u of dbUsers) {
      if ((u as any).zk_enroll_number) {
        dbMap.set((u as any).zk_enroll_number, u);
      }
    }

    // 2. Fetch Device users
    let deviceUsers: any[] = [];
    try {
      deviceUsers = await withZKConnection(async (zk) => {
        const response = await zk.getUsers();
        return Array.isArray(response.data) ? response.data : [];
      });
    } catch (err: any) {
      return NextResponse.json({
        error: 'Failed to connect to device to verify mapping',
        details: err.message
      }, { status: 503 });
    }

    const deviceMap = new Map<number, any>();
    deviceUsers.forEach(u => {
      const enrollNumber = parseInt(u.userId || u.uid || u.user_id, 10);
      if (!isNaN(enrollNumber)) {
        deviceMap.set(enrollNumber, u);
      }
    });

    // 3. Reconcile
    const onlyOnDevice: any[] = [];
    const onlyInDB: any[] = [];
    const matched: any[] = [];
    const mismatched: any[] = [];

    // Check device vs DB
    for (const [enrollNumber, devUser] of deviceMap.entries()) {
      const dbUser = dbMap.get(enrollNumber);
      if (!dbUser) {
        onlyOnDevice.push({ enrollNumber, deviceName: devUser.name });
      } else {
        // Simple name match check (truncating DB name to 24 chars for comparison since device truncates)
        const dbSafeName = dbUser.name.substring(0, 24);
        if (devUser.name !== dbSafeName) {
          mismatched.push({
            enrollNumber,
            deviceName: devUser.name,
            dbName: dbUser.name,
            dbUserId: dbUser.id
          });
        } else {
          matched.push({ enrollNumber, name: devUser.name, dbUserId: dbUser.id });
        }
      }
    }

    // Check DB vs Device
    for (const [enrollNumber, dbUser] of dbMap.entries()) {
      if (!deviceMap.has(enrollNumber)) {
        onlyInDB.push({ enrollNumber, dbName: dbUser.name, dbUserId: dbUser.id });
      }
    }

    return NextResponse.json({
      summary: {
        totalDBMapped: dbMap.size,
        totalDeviceUsers: deviceMap.size,
        matchedCount: matched.length,
        onlyOnDeviceCount: onlyOnDevice.length,
        onlyInDBCount: onlyInDB.length,
        mismatchedCount: mismatched.length
      },
      details: {
        matched,
        mismatched,
        onlyOnDevice,
        onlyInDB
      }
    });

  } catch (error: any) {
    console.error('[VerifyMapping] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
