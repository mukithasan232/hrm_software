import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { adminConfig, integrations } = await req.json();

    if (!adminConfig) {
      return NextResponse.json({ success: false, message: 'Missing admin configuration.' }, { status: 400 });
    }

    // 1. Create Super Admin role with highest permissions if not exists
    let superAdminRole = await prisma.role.findUnique({
      where: { name: 'Super Admin' }
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: 'Super Admin',
          description: 'Master Admin Role with full system access',
          permissions: { "*": true } // Grant all permissions
        }
      });
    }

    // 2. Hash the password and create/update the master user
    const superAdminData: any = {
      name: adminConfig.name,
      email: adminConfig.email,
      isActive: true,
      verificationStatus: 'ACTIVE',
      userType: 'Super Admin',
      permissions: { "*": true },
      roles: {
        connect: [{ id: superAdminRole.id }]
      }
    };

    if (adminConfig.password) {
      superAdminData.password = await bcrypt.hash(adminConfig.password, 10);
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminConfig.email }
    });

    if (existingAdmin) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: superAdminData
      });
    } else {
      if (!adminConfig.password) {
         return NextResponse.json({ success: false, message: 'Password is required for new Super Admin.' }, { status: 400 });
      }
      superAdminData.employeeId = 'ADMIN-001';
      await prisma.user.create({
        data: superAdminData
      });
    }

    // 3. Store ZKTeco integrations if provided
    if (integrations?.zktecoIp) {
      const existingDevice = await prisma.device.findFirst({
         where: { ipAddress: integrations.zktecoIp }
      });
      const portNumber = parseInt(integrations.zktecoPort || '4370', 10);
      
      if (existingDevice) {
         await prisma.device.update({
            where: { id: existingDevice.id },
            data: { port: portNumber, isActive: true }
         });
      } else {
         await prisma.device.create({
            data: {
               name: 'Main ZKTeco Device',
               ipAddress: integrations.zktecoIp,
               port: portNumber,
               isActive: true
            }
         });
      }
    }

    return NextResponse.json({ success: true, message: 'System settings saved successfully.' }, { status: 200 });
  } catch (error: any) {
    console.error('Save system config error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to save configuration.' }, { status: 400 });
  }
}
