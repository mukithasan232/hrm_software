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
      where: { userType: 'Employee' },
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
    const designationId = formData.get('designationId') as string;
    const employeeType = formData.get('employeeType') as 'REMOTE' | 'IN_HOUSE';
    const zk_enroll_number_str = formData.get('zk_enroll_number') as string;
    const zk_enroll_number = zk_enroll_number_str ? parseInt(zk_enroll_number_str, 10) : null;
    
    
    // Validate
    if (!name || !email || !password || !designationId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
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

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        employeeId: newEmployeeId,
        designationId,
        employeeType: employeeType || 'IN_HOUSE',
        userType: 'Employee',
        documents: documentPaths,
        zk_enroll_number: zk_enroll_number,
      },
      include: {
        customDesignation: true,
      }
    });

    // Send Welcome Email
    try {
      await sendWelcomeEmail(
        email,
        name,
        password,
        newUser.customDesignation?.name || 'Employee'
      );
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    return NextResponse.json({ message: 'Employee created successfully', user: newUser }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ message: 'Failed to create employee', error: error.message }, { status: 500 });
  }
}
