import type { Request, Response, NextFunction } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    designation: string;
  };
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;

      req.user = {
        id: decoded.id,
        designation: decoded.designation,
      };

      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
  const userDesig = (req.user?.designation || '').toLowerCase().trim();
  
  if (req.user && ADMIN_DESIGNATIONS.includes(userDesig)) {
    next();
  } else {
    console.error(`[Express Auth] Admin access denied. Received designation: "${req.user?.designation}"`);
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

export const authorizeDesignations = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
    const allowedLower = roles.map(r => r.toLowerCase().trim());
    const userDesig = (req.user?.designation || '').toLowerCase().trim();

    if (!req.user || (!allowedLower.includes(userDesig) && !ADMIN_DESIGNATIONS.includes(userDesig))) {
      console.error(`[Express Auth] Access denied. Allowed: ${roles.join(', ')}, got: "${req.user?.designation}"`);
      return res.status(403).json({ message: `Designation (${req.user?.designation}) is not allowed to access this resource.` });
    }
    next();
  };
};
