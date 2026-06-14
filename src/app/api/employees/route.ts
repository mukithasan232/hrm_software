export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '@/services/emailService';
import fs from 'fs';
import path from 'path';

// GET all employees
export async function GET() {
  try {
    const employees = await prisma.user.findMany({
      where: { 
        userType: 'Employee',
        employeeId: { not: 'UNMAPPED_FALLBACK' }
      },
      include: {
        customDesignation: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedEmployees = employees.map(emp => ({
      ...emp,
      designation: (emp as any).customDesignation
    }));

    return NextResponse.json(mappedEmployees);
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ message: 'Failed to fetch employees', error: error.message }, { status: 500 });
  }
}

// POST to create a new employee with files
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string || 'Employee';
    const designationId = formData.get('designationId') as string;
    const employeeType = formData.get('employeeType') as 'REMOTE' | 'IN_HOUSE';
    const department = formData.get('department') as string;
    const zk_enroll_number_str = formData.get('zk_enroll_number') as string;
    const zk_enroll_number = zk_enroll_number_str && zk_enroll_number_str.trim() !== '' ? parseInt(zk_enroll_number_str, 10) : null;
    
    console.log("Incoming IDs:", { designationId, department, role });
    
    // Validate
    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    if (role === 'Employee' && !designationId) {
      return NextResponse.json({ message: 'Designation is required for employees' }, { status: 400 });
    }

    // Auto-generate employeeId
    // Fetch last employee to increment ID
    const lastUser = await prisma.user.findFirst({
      where: { employeeId: { startsWith: 'EMP-' } },
      orderBy: { employeeId: 'desc' },
    });

    let newEmployeeId = 'EMP-1001';
    if (lastUser && lastUser.employeeId) {
      const match = lastUser.employeeId.match(/EMP-(\d+)/);
      if (match && match[1]) {
        const nextNum = parseInt(match[1], 10) + 1;
        newEmployeeId = `EMP-${nextNum}`;
      }
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: 'Email already exists' }, { status: 400 });
    }

    // Handle files
    const documentPaths: Record<string, string> = {};
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    
    // Ensure dir exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileFields = ['cv', 'nid', 'certificates'];
    for (const field of fileFields) {
      const file = formData.get(field) as File | null;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = path.extname(file.name) || '.pdf';
        const fileName = `${newEmployeeId}_${field}_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        documentPaths[field] = `/uploads/documents/${fileName}`;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let newUser;
    try {
      // Wrap database operations in a $transaction to ensure atomic saves
      newUser = await prisma.$transaction(async (tx) => {
        // Step A: Create User record (acts as both User & Employee in this unified schema)
        const createdUser = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            employeeId: newEmployeeId,
            designationId: role === 'Employee' ? designationId : null,
            department: role === 'Employee' ? (department || null) : null,
            employeeType: role === 'Employee' ? (employeeType || 'IN_HOUSE') : 'IN_HOUSE',
            userType: role,
            documents: role === 'Employee' ? documentPaths : {},
            zk_enroll_number: role === 'Employee' ? zk_enroll_number : null,
          },
          include: {
            customDesignation: true,
          }
        });

        // Step B: Relational operations / Backfill Attendance Logs from RawDeviceLog
        if (role === 'Employee' && zk_enroll_number !== null && zk_enroll_number !== undefined) {
          const rawLogs = await tx.rawDeviceLog.findMany({
            where: { deviceUserId: zk_enroll_number.toString() }
          });

          if (rawLogs.length > 0) {
            const attendanceData = rawLogs.map((log: any) => ({
              employeeId: createdUser.id,
              timestamp: log.recordTime,
              punchType: log.punchType || 'CheckIn',
              deviceId: log.ip || 'ZKTeco Device'
            }));

            await tx.attendanceLog.createMany({
              data: attendanceData,
              skipDuplicates: true
            });

            await tx.rawDeviceLog.deleteMany({
              where: { deviceUserId: zk_enroll_number.toString() }
            });
            console.log(`[Magic Bridge] 🌉 Backfilled ${rawLogs.length} historical punches for ${name}`);
          }
        }

        return createdUser;
      });
    } catch (txError: any) {
      console.error('Transaction Failed:', txError);
      if (txError.code === 'P2002') {
        const target = txError.meta?.target || '';
        if (target.includes('email')) {
          throw new Error('Email already exists in the system');
        } else if (target.includes('employeeId')) {
          throw new Error('Employee ID collision occurred, please try again');
        } else if (target.includes('zk_enroll_number')) {
          throw new Error('Device ID (Enroll Number) is already assigned to another user');
        }
      }
      throw new Error('Database transaction failed while creating employee record');
    }

    // Send Welcome Email
    try {
      await sendWelcomeEmail(
        email,
        name,
        password,
        newUser.customDesignation?.name || 'Employee',
        undefined,
        zk_enroll_number
      );
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    return NextResponse.json({ message: 'Employee created successfully', user: newUser }, { status: 201 });

  } catch (error: any) {
    console.error('Employee Creation Error:', error);
    return NextResponse.json({ error: error.message || "Failed to create employee" }, { status: 400 });
  }
}
