import type { Request, Response } from 'express-serve-static-core';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { sendWelcomeEmail } from '../services/emailService';
import { processRawDeviceLogs } from '../services/zkService';
import { eventEmitter } from '../lib/eventEmitter';

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cursor, limit = '20', search = '', designation = 'All' } = req.query;
    
    const take = parseInt(limit as string, 10);
    
    const where: any = {
      employeeId: { not: 'UNMAPPED_FALLBACK' },
      userType: { not: 'Employee' }
    };
    if (search) {
      const q = (search as string).toLowerCase();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (designation !== 'All') {
      where.OR = [
        ...(where.OR || []),
        { customDesignation: { name: designation as string } }
      ];
    }

    const users = await prisma.user.findMany({
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor as string } } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        designationId: true,
        customDesignation: { select: { id: true, name: true } },
        department: true,
        departmentId: true,
        customDepartment: { select: { id: true, name: true, shiftStartTime: true, shiftEndTime: true } },
        shiftId: true,
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        shiftStartTime: true,
        shiftEndTime: true,
        baseSalary: true,
        leaveConfig: true,
        isActive: true,
        joiningDate: true,
        profileImage: true,
        casualLeaveAdjustment: true,
        sickLeaveAdjustment: true,
        permissions: true,
        documents: true,
        // @ts-ignore
        salaryAccount: true,
        // @ts-ignore
        appointmentLetter: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    const totalCount = await prisma.user.count({ where });
    const nextCursor = users.length === take ? users[take - 1].id : null;

    const mappedUsers = users.map(u => ({ ...u, designation: (u as any).customDesignation }));

    res.status(200).json({
      data: mappedUsers,
      nextCursor,
      totalCount
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findFirst({
      where: { id: String(userId) },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        customDesignation: { select: { id: true, name: true, permissions: true } },
        department: true,
        customDepartment: { select: { id: true, name: true, shiftStartTime: true, shiftEndTime: true } },
        designation: true,
        shiftId: true,
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        shiftStartTime: true,
        shiftEndTime: true,
        baseSalary: true,
        isActive: true,
        joiningDate: true,
        profileImage: true,
        phone: true,
        permissions: true,
        facebookUrl: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        verificationStatus: true,
        documents: true,
        // @ts-ignore
        appointmentLetter: true,
        // @ts-ignore
        salaryAccount: true,
      }
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    // Fallback: merge customDesignation permissions if user.permissions is not already merged
    let finalPerms = {};
    // @ts-ignore
    if (user.customDesignation?.permissions) {
      // @ts-ignore
      const dPerms = typeof user.customDesignation.permissions === 'string' 
        // @ts-ignore
        ? JSON.parse(user.customDesignation.permissions) 
        // @ts-ignore
        : user.customDesignation.permissions;
      finalPerms = { ...finalPerms, ...dPerms };
    }
    if (user.permissions) {
      const uPerms = typeof user.permissions === 'string' 
        ? JSON.parse(user.permissions) 
        : user.permissions;
      finalPerms = { ...finalPerms, ...uPerms };
    }
    (user as any).permissions = finalPerms;

    res.status(200).json({ 
      ...user, 
      permissions: finalPerms,
      designation: user.designation || (user as any).customDesignation?.name 
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const loggedInUser = (req as any).user;
    const { id, name, department, designation, phone, facebookUrl, linkedinUrl, githubUrl, portfolioUrl } = req.body as any;
    const targetUserId = id || loggedInUser.id;

    if (targetUserId !== loggedInUser.id) {
      const adminCheck = await prisma.user.findUnique({
        where: { id: loggedInUser.id },
        include: { customDesignation: true }
      });
      const isAdmin = ['Admin', 'Super Admin'].includes(adminCheck?.customDesignation?.name || '');
      if (!isAdmin) {
        res.status(403).json({ message: 'Not authorized to edit other profiles' });
        return;
      }
    }

    // Helper: trim & store empty string as null so DB stays clean
    const sanitizeUrl = (val: string | undefined) =>
      val !== undefined ? (val.trim() || null) : undefined;

    const data: any = {};
    if (name?.trim()) data.name = name.trim();
    if (department !== undefined) data.department = department?.trim() || null;
    if (designation !== undefined) data.designation = designation?.trim() || null;
    
    if (phone !== undefined)    data.phone    = phone?.trim() || null;
    if (facebookUrl !== undefined) data.facebookUrl = sanitizeUrl(facebookUrl);
    if (linkedinUrl !== undefined) data.linkedinUrl = sanitizeUrl(linkedinUrl);
    if (githubUrl   !== undefined) data.githubUrl   = sanitizeUrl(githubUrl);
    if (portfolioUrl !== undefined) data.portfolioUrl = sanitizeUrl(portfolioUrl);

    const reqFile = (req as any).file;
    if (reqFile) {
      if (reqFile.avatar) {
        data.profileImage = reqFile.avatar.path;
      } else if (reqFile.filename) {
        data.profileImage = `/api/storage/avatars/${reqFile.filename}`;
      }
    }

    try {
      const user = await prisma.user.update({
        where: { id: targetUserId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          designation: true,
          customDesignation: { select: { id: true, name: true } },
          profileImage: true,
          phone: true,
          facebookUrl: true,
          linkedinUrl: true,
          githubUrl: true,
          portfolioUrl: true,
          // @ts-ignore
          salaryAccount: true,
          // @ts-ignore
          appointmentLetter: true,
          verificationStatus: true,
        }
      });
      res.status(200).json({ message: 'Profile updated successfully', user: { ...user, designation: user.designation || (user as any).customDesignation?.name } });
    } catch (dbError: any) {
      console.error('[Profile Update Error]: ', dbError);
      res.status(500).json({ error: 'Database update failed', details: dbError.message });
    }
  } catch (error: any) {
    console.error('[Profile Update Error]: ', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body as any;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = (req as any).params as { id: string };
    const { name, designationId, shiftId, shiftStartTime, shiftEndTime, department, baseSalary, isActive, employeeType, zktecoId, roles, leaveConfig, casualLeaveAdjustment, sickLeaveAdjustment, permissions, salaryAccount } = req.body as any;
    let finalDesignationId = designationId !== undefined ? (designationId || null) : undefined;
    if (finalDesignationId && !finalDesignationId.includes('-')) {
      let desig = await prisma.designation.findFirst({
        where: { name: { equals: finalDesignationId } }
      });
      if (!desig) {
        desig = await prisma.designation.create({ data: { name: finalDesignationId } });
      }
      finalDesignationId = desig.id;
    }

    let rolesToConnect;
    if (roles) {
      try {
        const parsedRoles = typeof roles === 'string' ? JSON.parse(roles) : roles;
        rolesToConnect = { set: parsedRoles.map((roleId: string) => ({ id: roleId })) };
      } catch (e) {
        console.error('Error parsing roles:', e);
      }
    }

    let finalDepartmentId = undefined;
    if (department !== undefined) {
      if (department) {
        const dept = await prisma.department.findFirst({ where: { name: department } });
        if (dept) finalDepartmentId = dept.id;
      } else {
        finalDepartmentId = null;
      }
    }

    const user = await prisma.user.update({
      where: { id: id as string },
      data: {
        name,
        designationId: finalDesignationId,
        shiftId: shiftId === '' || shiftId === 'null' ? null : (shiftId !== undefined ? shiftId : undefined),
        shiftStartTime: shiftStartTime === '' || shiftStartTime === 'null' ? null : (shiftStartTime !== undefined ? shiftStartTime : undefined),
        shiftEndTime: shiftEndTime === '' || shiftEndTime === 'null' ? null : (shiftEndTime !== undefined ? shiftEndTime : undefined),
        department,
        departmentId: finalDepartmentId,
        employeeType: employeeType || undefined,
        baseSalary: baseSalary ? Number(baseSalary) : undefined,
        leaveConfig: leaveConfig !== undefined ? (typeof leaveConfig === 'string' ? JSON.parse(leaveConfig) : leaveConfig) : undefined,
        zktecoId: zktecoId ? parseInt(zktecoId, 10) : undefined,
        casualLeaveAdjustment: casualLeaveAdjustment !== undefined ? Number(casualLeaveAdjustment) : undefined,
        sickLeaveAdjustment: sickLeaveAdjustment !== undefined ? Number(sickLeaveAdjustment) : undefined,
        permissions: permissions !== undefined ? (typeof permissions === 'string' ? JSON.parse(permissions) : permissions) : undefined,
        // @ts-ignore
        salaryAccount: salaryAccount !== undefined ? salaryAccount : undefined,
        isActive,
        ...(rolesToConnect && { roles: rolesToConnect }),
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        designationId: true,
        customDesignation: { select: { id: true, name: true } },
        department: true,
        employeeType: true,
        baseSalary: true,
        leaveConfig: true,
        casualLeaveAdjustment: true,
        sickLeaveAdjustment: true,
        permissions: true,
        isActive: true,
        zktecoId: true,
        documents: true,
        // @ts-ignore
        salaryAccount: true,
        // @ts-ignore
        appointmentLetter: true,
        verificationStatus: true,
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    // --- MAGIC BRIDGE: Backfill Attendance Logs from RawDeviceLog ---
    // We removed the manual 'Magic Bridge' backfill here because it hardcoded 'CheckIn'.
    if (zktecoId !== null && zktecoId !== undefined) {
      try {
        await processRawDeviceLogs();
        console.log(`[Magic Bridge] 🌉 Triggered official backfill for ${user.name}`);
      } catch (bridgeErr) {
        console.error('[Magic Bridge] ❌ Failed to backfill logs:', bridgeErr);
      }
    }

    res.status(200).json({ message: 'Employee updated', user: { ...user, designation: (user as any).customDesignation } });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update employee', error: error.message });
  }
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, designationId, department, baseSalary, sendEmail, employeeType, roles, leaveConfig } = req.body as any;

    // Auto-generate Employee ID sequentially
    const allUsers = await prisma.user.findMany({ select: { employeeId: true } });
    const maxId = allUsers.reduce((max, u) => {
      const n = parseInt(u.employeeId?.replace(/\\D/g, '') || '0', 10);
      return n > max ? n : max;
    }, 0);
    const generatedEmployeeId = `EMP${String(maxId + 1).padStart(3, '0')}`;

    const exists = await prisma.user.findFirst({
      where: { email }
    });

    if (exists) {
      res.status(400).json({ message: 'An employee with this email already exists.' });
      return;
    }

    const plainPassword = password || 'password123';
    const hashed = await bcrypt.hash(plainPassword, 10);

    let finalDesignationId = designationId || null;
    let designationPermissions: any = {};

    if (finalDesignationId && !finalDesignationId.includes('-')) {
      let desig = await prisma.designation.findFirst({
        where: { name: { equals: finalDesignationId } }
      });
      if (!desig) {
        desig = await prisma.designation.create({ data: { name: finalDesignationId } });
      }
      finalDesignationId = desig.id;
      designationPermissions = desig.permissions || {};
    } else if (finalDesignationId) {
      const desig = await prisma.designation.findUnique({ where: { id: finalDesignationId } });
      if (desig) {
        designationPermissions = desig.permissions || {};
      }
    }

    let actualRoleIds: string[] = [];
    if (roles) {
      const parsedRoles = typeof roles === 'string' ? JSON.parse(roles) : roles;
      for (const rId of parsedRoles) {
        let r = await prisma.role.findFirst({ where: { OR: [{ id: rId }, { name: rId }] } });
        if (!r) r = await prisma.role.create({ data: { name: rId, description: `Auto-created ${rId}` } });
        actualRoleIds.push(r.id);
      }
    }

    const user = await prisma.user.create({
      data: {
        employeeId: generatedEmployeeId,
        name,
        email,
        password: hashed,
        designationId: finalDesignationId,
        department,
        employeeType: employeeType || 'IN_HOUSE',
        baseSalary: Number(baseSalary) || 0,
        leaveConfig: leaveConfig ? (typeof leaveConfig === 'string' ? JSON.parse(leaveConfig) : leaveConfig) : {},
        permissions: designationPermissions,
        joiningDate: new Date(),
        ...(roles && {
          roles: {
            connect: actualRoleIds.map((id: string) => ({ id }))
          }
        }),
      },
      include: { customDesignation: true }
    });

    if (sendEmail) {
      try {
        await sendWelcomeEmail(email, name, plainPassword, user.customDesignation?.name || 'Employee', undefined, undefined, generatedEmployeeId);
      } catch (emailError: any) {
        console.error('[createEmployee] Failed to send welcome email:', emailError.message);
      }
    }

    // Notify Admins
    try {
      const hrAndManagers = await prisma.user.findMany({
        where: {
          customDesignation: { name: { in: ['Admin', 'Super Admin', 'System Administrator', 'HR'] } }
        }
      });

      const notifications = hrAndManagers.map((u: any) => ({
        userId: u.id,
        titleEn: 'New Employee Onboarded',
        titleBn: 'নতুন কর্মচারী যুক্ত হয়েছে',
        messageEn: `${name} has been added to the system.`,
        messageBn: `${name}-কে সিস্টেমে যুক্ত করা হয়েছে।`,
        type: 'USER_MANAGEMENT'
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
        notifications.forEach((n) => eventEmitter.emit('new-notification', { ...n, id: Math.random().toString(36).substring(7), createdAt: new Date() }));
      }
    } catch (notifyError: any) {
      console.error('[createEmployee] Failed to create notifications:', notifyError.message);
    }

    const { password: _, customDesignation, ...userWithoutPassword } = user;
    res.status(201).json({
      message: 'Employee created successfully',
      user: userWithoutPassword,
    });
  } catch (error: any) {
    console.error('API_VALIDATION_ERROR:', error);
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
};

export const toggleEmployeeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = (req as any).params as { id: string };
    const emp = await prisma.user.findUnique({ where: { id: id as string } });
    if (!emp) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }
    
    const updated = await prisma.user.update({
      where: { id: id as string },
      data: { isActive: !emp.isActive }
    });

    res.status(200).json({ message: `Employee ${updated.isActive ? 'activated' : 'deactivated'}`, isActive: updated.isActive });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to toggle status', error: error.message });
  }
};

// @desc    Seed a specific test user for biometric matching
// @route   POST /api/users/seed-test-user
// @access  Public (for dev/testing)
export const seedTestUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetEmployeeId = "5";
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Fetch default designation 'Employee'
    const defaultDesig = await prisma.designation.findFirst({ where: { name: 'Employee' } });

    const userData = {
      name: 'Tushar',
      email: 'tushar@example.com',
      password: hashedPassword,
      designationId: defaultDesig?.id || undefined,
      employeeId: targetEmployeeId,
      baseSalary: 45000,
      department: 'Engineering',
      isActive: true
    };

    const user = await prisma.user.upsert({
      where: { employeeId: targetEmployeeId },
      update: userData,
      create: userData
    });

    console.log('[UserController] ✅ Seeded Test User:', user.employeeId);
    res.status(200).json({ message: 'Test user seeded successfully', user });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to seed test user', error: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = ((req as any).params as { id: string }).id;
    
    // Find the user first to retrieve their unique employeeId
    const emp = await prisma.user.findUnique({ where: { id } });
    if (!emp) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }
    
    const employeeId = emp.employeeId as string;

    console.log(`🗑️ [deleteEmployee] Initiating transactional cascade delete for employee ${emp.name} (ID: ${employeeId})`);

    // Relational cleanup is primarily handled by onDelete: Cascade in schema.prisma.
    // However, Announcement does not have cascade delete, so we clean it up manually first.
    await prisma.$transaction([
      prisma.announcement.deleteMany({ where: { authorId: id } }),
      prisma.user.delete({ where: { id } })
    ]);

    console.log(`✅ [deleteEmployee] Successfully deleted employee ${emp.name} and all related records.`);
    res.status(200).json({ message: 'Employee and all associated records deleted successfully.' });
  } catch (error: any) {
    console.error('❌ [deleteEmployee] Error deleting employee:', error);
    res.status(500).json({ message: 'Failed to delete employee', error: error.message });
  }
};
