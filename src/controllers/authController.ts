import type { Request, Response } from 'express-serve-static-core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '1d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { employeeId, name, email, password, role, department, designation, baseSalary } = req.body;

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
        role: role || 'Employee',
        department,
        designation,
        baseSalary,
      }
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id, user.role),
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

    // Support both email and employeeId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { employeeId: email }
        ]
      }
    });

    if (!user) {
      console.log(`[Auth] ❌ User not found for identifier: "${email}"`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[Auth] 👤 User found: ${user.email} (ID: ${user.id})`);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[Auth] ❌ Password mismatch for: "${email}"`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[Auth] ✅ Login success: ${user.email} (Role: ${user.role})`);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      profileImage: user.profileImage,
      token: generateToken(user.id, user.role),
    });
  } catch (error: any) {
    console.error(`[Auth] 🔥 Server Error during login: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

