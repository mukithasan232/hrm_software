export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail, sendMail } from '@/services/emailService';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { processRawDeviceLogs } from '@/services/zkService';
import { wrapHandler } from '@/lib/adapter';
import { checkPermission, getPermissionScopeSync } from '@/utils/checkPermission';

// GET all employees
export const GET = wrapHandler(async (req: any, res: any) => {
  try {
    const user = req.user;
    const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'hrm manager', 'hr'];
    const designName = typeof user?.designation === 'string' ? user.designation : (user?.designation as any)?.name || '';
    const userDesig = designName.toLowerCase().trim();
    const hasAdminRole = user?.roles?.some((r: any) => 
      ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
    );
    const isAdmin = ADMIN_DESIGNATIONS.includes(userDesig) || hasAdminRole;
    
    // Instead of boolean checkPermission, get the exact scope level
    const { getPermissionScopeSync, getScopedWhereClause } = await import('@/utils/checkPermission');
    let readScope = isAdmin ? 'all' : getPermissionScopeSync(user, 'Employees', 'read');
    
    // If fetching for task assignment, evaluate task scope as a fallback
    if (!isAdmin && req.query?.purpose === 'task_assignment') {
      const taskScope = getPermissionScopeSync(user, 'Tasks', 'create');
      if (taskScope === 'all' || taskScope === 'department') {
        readScope = taskScope;
      }
    }

    // If fetching for leave management, evaluate leave scope or manager role
    if (!isAdmin && req.query?.purpose === 'leave_management') {
      const leaveScope = getPermissionScopeSync(user, 'Leaves', 'read');
      const isManager = ['manager', 'team lead', 'lead'].some(d => userDesig.includes(d));
      
      if (leaveScope === 'all' || leaveScope === 'department') {
        readScope = leaveScope;
      } else if (isManager) {
        readScope = 'department';
      }
    }

    let where: any = { 
      userType: 'Employee',
      employeeId: { not: 'UNMAPPED_FALLBACK' }
    };

    if (!isAdmin) {
      const scopeWhere = getScopedWhereClause(user, 'Employees', 'read');
      Object.assign(where, scopeWhere);
    }

    const employees = await prisma.user.findMany({
      where,
      include: {
        customDesignation: {
          select: { name: true }
        },
        shift: true,
        customDepartment: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedEmployees = employees.map((emp: any) => ({
      ...emp,
      designation: (emp as any).customDesignation
    }));

    return res.status(200).json(mappedEmployees);
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
}, { protect: true });

// POST to create a new employee with files
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const rolesStr = formData.get('roles') as string;
    const roleIds = rolesStr ? JSON.parse(rolesStr) : [];
    const designationId = formData.get('designationId') as string;
    const shiftId = formData.get('shiftId') as string;
    const employeeType = formData.get('employeeType') as 'REMOTE' | 'IN_HOUSE';
    const department = formData.get('department') as string;
    const zktecoId_str = formData.get('zktecoId') as string;
    const zktecoId = zktecoId_str && zktecoId_str.trim() !== '' ? zktecoId_str : null;
    const baseSalaryStr = formData.get('baseSalary') as string;
    const baseSalary = baseSalaryStr ? parseFloat(baseSalaryStr) : 0;
    const leaveConfigStr = formData.get('leaveConfig') as string;
    const leaveConfig = leaveConfigStr ? JSON.parse(leaveConfigStr) : undefined;
    const permissionsStr = formData.get('permissions') as string;
    const permissions = permissionsStr ? JSON.parse(permissionsStr) : undefined;
    
    // Add Debug Console Log as requested
    const debugBody = Object.fromEntries(formData as any);
    console.log("INCOMING NEW EMPLOYEE DATA:", debugBody);
    
    console.log("DEBUG_REQUEST_BODY:", { name, email, roleIds, designationId, department, employeeType, zktecoId });
    console.log("ROLES_PAYLOAD:", roleIds);
    
    // Validate
    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    if (!designationId) {
      return NextResponse.json({ message: 'Designation is required' }, { status: 400 });
    }
    if (roleIds.length === 0) {
      return NextResponse.json({ message: 'Please select at least one role' }, { status: 400 });
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
        // Step A: Ensure roles exist and get their IDs
        const actualRoleIds: string[] = [];
        for (const roleNameOrId of roleIds) {
          let role = await tx.role.findFirst({
            where: {
              OR: [
                { id: roleNameOrId },
                { name: roleNameOrId }
              ]
            }
          });
          if (!role) {
            role = await tx.role.create({
              data: { name: roleNameOrId, description: `Auto-created ${roleNameOrId} role` }
            });
          }
          actualRoleIds.push(role.id);
        }

        let finalDepartmentId = null;
        if (department) {
          const dept = await tx.department.findFirst({ where: { name: department } });
          if (dept) finalDepartmentId = dept.id;
        }

        // Step A2: Create User record (acts as both User & Employee in this unified schema)
        // Admins are also employees, so we save all HR fields for all roles.
        const createdUser = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            employeeId: newEmployeeId,
            userType: 'Employee', // Legacy field fallback
            roles: {
              connect: actualRoleIds.map((id: string) => ({ id }))
            },
            
            // HR-Specific Fields (Populated for ALL roles now)
            designationId: designationId || null,
            shiftId: shiftId || null,
            department: department || null,
            departmentId: finalDepartmentId,
            employeeType: employeeType || 'IN_HOUSE',
            baseSalary: baseSalary || 0,
            // CRITICAL FIX: Parse the ID safely for Prisma
            zktecoId: zktecoId ? parseInt(zktecoId.toString(), 10) : null,
            documents: documentPaths,
            leaveConfig: leaveConfig || {},
            permissions: permissions || {},
            verificationStatus: 'UNVERIFIED',
          },
          include: {
            customDesignation: true,
          }
        });

        // We removed the manual 'Magic Bridge' backfill here because it hardcoded 'CheckIn'.
        // We will call the official processRawDeviceLogs() outside the transaction.

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
        } else if (target.includes('zktecoId')) {
          throw new Error('Device ID (Enroll Number) is already assigned to another user');
        }
      }
      throw new Error(`Database transaction failed: ${txError.message}`);
    }
    
    // Call the official sync logic which enforces chronological CheckIn/CheckOut toggles
    try {
      if (zktecoId !== null && zktecoId !== undefined) {
        await processRawDeviceLogs();
      }
    } catch (e) {
      console.error('[Magic Bridge] Failed to process raw logs:', e);
    }

    // Send Welcome Email with Login Details
    let emailSent = true;
    try {
      const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="background: #4f46e5; padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to the Team!</h1>
            <p style="color: #e0e7ff; margin-top: 8px;">Your employee account has been created.</p>
          </div>
          <div style="padding: 30px;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We are thrilled to welcome you to the team. Your secure HR portal login credentials have been generated:</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Enrollment ID:</strong> ${newUser.employeeId}</p>
              <p style="margin: 0 0 10px 0;"><strong>Login Email:</strong> ${email}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> ${password}</p>
            </div>
            <p>Please log in to the portal to upload your necessary documents for verification. Your Appointment Letter will be issued upon approval.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${loginUrl}/login" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold;">Log In Now</a>
            </div>
          </div>
        </div>
      `;

      await sendMail({
        to: email,
        subject: "Welcome to the Team - Your Login Details",
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Error sending welcome email with PDF:', emailError);
      emailSent = false;
    }

    if (!emailSent) {
      return NextResponse.json({ message: 'Employee created successfully, but email failed to send', user: newUser, warning: true }, { status: 201 });
    }

    return NextResponse.json({ message: 'Employee created successfully', user: newUser }, { status: 201 });

  } catch (error: any) {
    console.error('API_VALIDATION_ERROR:', error);
    return NextResponse.json({ message: error.message || "Failed to create employee" }, { status: 400 });
  }
}
