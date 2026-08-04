import type { Request, Response } from 'express-serve-static-core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const generateToken = (id: string, designationName: string, email: string, userType: string, roles: any[] = [], permissions: any = {}) => {
  return jwt.sign({ id, designation: designationName, email, userType, roles, permissions }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { employeeId, name, email, password, department, designationId, baseSalary } = req.body;

    const userExists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { employeeId }]
      }
    });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email or employee ID' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        employeeId,
        name,
        email,
        password: hashedPassword,
        department,
        designationId,
        baseSalary,
        documents: {},
      },
      include: {
        customDesignation: true,
      }
    });

    res.status(201).json({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      designation: user.customDesignation?.name || 'Employee',
      token: generateToken(user.id, user.customDesignation?.name || 'Employee', user.email || '', user.userType || '', [], {}),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
export const loginUser = async (req: Request, res: Response) => {
  try {
    // 🚀 ENV CHECKS
    if (!process.env.DATABASE_URL) {
      console.error("CRITICAL: DATABASE_URL is not set in environment variables!");
    }
    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET is not set in environment variables!");
    }
    let email: string | undefined;
    let password: string | undefined;

    try {
      email = req.body?.email;
      password = req.body?.password;
    } catch (bodyErr) {
      console.error('[Auth] ❌ Failed to read request body');
      return res.status(400).json({ message: 'Invalid request body' });
    }

    console.log(`[Auth] 🔑 Login attempt for: "${email}"`);

    if (!email || !password) {
      console.log('[Auth] ❌ Missing email or password');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Support both email and employeeId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { employeeId: email }
        ]
      },
      include: {
        customDesignation: true,
        roles: true,
        userPermission: true,
        shift: true,
        customDepartment: true
      }
    });

    if (!user || !user.password) {
      console.log(`[Auth] ❌ User not found or missing password for identifier: "${email}"`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[Auth] 👤 User found: ${user.email} (ID: ${user.id})`);

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (bcryptErr) {
      console.error('[Auth] ❌ bcrypt error:', bcryptErr);
      return res.status(500).json({ message: 'Authentication error. Please try again.' });
    }

    if (!isMatch) {
      console.log(`[Auth] ❌ Password mismatch for: "${email}"`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const designationName = user.customDesignation?.name || 'Employee';
    const roles = user.roles || [];
    
    // Merge all permission sources: Designation -> Roles -> UserOverrides
    let permissions: any = {};
    try {
      if (user.customDesignation?.permissions) {
        const dPerms = typeof user.customDesignation.permissions === 'string' 
          ? JSON.parse(user.customDesignation.permissions) 
          : user.customDesignation.permissions;
        permissions = { ...permissions, ...dPerms };
      }
      
      roles.forEach((r: any) => {
        if (r.permissions) {
          const rPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
          permissions = { ...permissions, ...rPerms };
        }
      });

      if (user.permissions) {
        const dbPerms = typeof user.permissions === 'string'
          ? JSON.parse(user.permissions)
          : user.permissions;
        permissions = { ...permissions, ...dbPerms };
      }

      if (user.userPermission?.matrix) {
        const uPerms = typeof user.userPermission.matrix === 'string'
          ? JSON.parse(user.userPermission.matrix)
          : user.userPermission.matrix;
        permissions = { ...permissions, ...uPerms };
      }
    } catch (permErr) {
      console.warn('[Auth] ⚠️ Permission merge error (non-fatal):', permErr);
      // Continue with whatever permissions were built so far
    }

    user.permissions = permissions;

    console.log(`[Auth] ✅ Login success: ${user.email} (Designation: ${designationName})`);

    return res.json({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      userType: user.userType,
      designation: designationName,
      department: user.department,
      customDepartment: user.customDepartment,
      shift: user.shift,
      profileImage: user.profileImage,
      phone: user.phone,
      roles: roles,
      permissions: user.permissions,
      verificationStatus: user.verificationStatus,
      documents: user.documents,
      appointmentLetter: user.appointmentLetter,
      salaryAccount: user.salaryAccount,
      token: generateToken(user.id, designationName, user.email, user.userType, roles, user.permissions),
    });
  } catch (error: any) {
    console.error("========================================");
    console.error("🚨 LOGIN API CRASH 🚨");
    console.error("MESSAGE:", error.message);
    console.error("STACK:", error.stack);
    console.error("FULL ERROR:", error);
    console.error("========================================");
    
    // 🚀 CATCH ALL: Always return valid JSON — never a blank response
    return res.status(500).json({ message: 'Internal server error. Please contact support.' });
  }
};

