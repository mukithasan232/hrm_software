import type { Request, Response } from 'express-serve-static-core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const generateToken = (id: string, designationName: string, roles: any[] = [], permissions: any = {}) => {
  return jwt.sign({ id, designation: designationName, roles, permissions }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '1d',
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
      token: generateToken(user.id, user.customDesignation?.name || 'Employee', [], {}),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log(`[Auth] 🔑 Login attempt for: "${email}"`);

    if (!email || !password) {
      console.log('[Auth] ❌ Missing email or password');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Ensure standard authentication flow through the database only

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
        userPermission: true
      }
    });

    if (!user) {
      console.log(`[Auth] ❌ User not found for identifier: "${email}"`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[Auth] 👤 User found: ${user.email} (ID: ${user.id})`);

    // ── TEMPORARY DEBUG — remove after confirming login works on production ──
    console.log('[Auth] LOGIN_DEBUG:', {
      inputPassword:  password,
      databaseHash:   user.password,
      hashPrefix:     user.password?.substring(0, 20),
      hashLength:     user.password?.length,
    });
    // ────────────────────────────────────────────────────────────────────────

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[Auth] ❌ Password mismatch for: "${email}"`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const designationName = user.customDesignation?.name || 'Employee';
    const roles = user.roles || [];
    
    // Merge all permission sources: Designation -> Roles -> UserOverrides
    let permissions = {};
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
      // User specific permissions override designation/role permissions
      permissions = { ...permissions, ...uPerms };
    }

    console.log(`[Auth] ✅ Login success: ${user.email} (Designation: ${designationName})`);

    res.json({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      designation: designationName,
      department: user.department,
      profileImage: user.profileImage,
      phone: user.phone,
      roles: roles,
      permissions: permissions,
      token: generateToken(user.id, designationName, roles, permissions),
    });
  } catch (error: any) {
    console.error(`[Auth] 🔥 Server Error during login: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

